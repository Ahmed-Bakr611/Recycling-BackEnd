// controllers/userController.ts
import { Request, Response } from "express";
import User from "../models/users";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { 
      role, 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter: any = {};
    
    if (role) {
      filter.role = role;
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute queries
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select("-password -refreshToken")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalUsers / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPrevPage = Number(page) > 1;

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalUsers,
        hasNextPage,
        hasPrevPage,
        limit: Number(limit)
      },
      filters: {
        role: role || null,
        search: search || null
      }
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
  }
};
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

export const updateUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    console.log("deleting user");
    console.log(req.params.id);
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Deletion failed" });
  }
};
export const searchUsers = async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const regex = new RegExp(q, "i");

  try {
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }],
    }).select("-password");

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
};


export const getUserStats = async (req: Request, res: Response) => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const stats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    const monthsMap = [
      "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const formatted = stats.map((item) => ({
      label: `${monthsMap[item._id.month]} ${item._id.year}`,
      count: item.count,
    }));

return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error getting user stats:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const addUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, orderId, reason = "Order completion" } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid points amount" 
      });
    }

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Add points to user's total
    user.totalPoints = (user.totalPoints || 0) + points;
    
    // Add to points history
    if (!user.pointsHistory) {
      user.pointsHistory = [];
    }
    
    user.pointsHistory.push({
      orderId,
      points,
      type: 'earned',
      reason,
      timestamp: new Date()
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: "Points added successfully",
      data: {
        userId: user._id,
        totalPoints: user.totalPoints,
        pointsAdded: points
      }
    });
  } catch (error) {
    console.error("Error adding points:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while adding points" 
    });
  }
};

// Deduct points from user
export const deductUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, reason = "Points deduction" } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid points amount" 
      });
    }

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    const currentPoints = user.totalPoints || 0;
    
    // Check if user has enough points
    if (currentPoints < points) {
      return res.status(400).json({ 
        success: false, 
        message: "Insufficient points",
        data: {
          currentPoints,
          requestedPoints: points
        }
      });
    }

    // Deduct points
    user.totalPoints = currentPoints - points;
    
    // Add to points history
    if (!user.pointsHistory) {
      user.pointsHistory = [];
    }
    
    user.pointsHistory.push({
      points: -points,
      type: 'deducted',
      reason,
      timestamp: new Date()
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: "Points deducted successfully",
      data: {
        userId: user._id,
        totalPoints: user.totalPoints,
        pointsDeducted: points
      }
    });
  } catch (error) {
    console.error("Error deducting points:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while deducting points" 
    });
  }
};



export const getUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;

    const user = await User.findById(userId).select("totalPoints pointsHistory name email");
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Paginate points history
    const pointsHistory = user.pointsHistory || [];
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedHistory = pointsHistory
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        totalPoints: user.totalPoints || 0,
        pointsHistory: paginatedHistory,
        pagination: {
          currentPage: Number(page),
          totalItems: pointsHistory.length,
          totalPages: Math.ceil(pointsHistory.length / Number(limit)),
          hasMore: endIndex < pointsHistory.length
        }
      }
    });
  } catch (error) {
    console.error("Error getting user points:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching points" 
    });
  }
};

export const getPointsLeaderboard = async (req: Request, res: Response) => {
  
  try {
    const { limit = 10 } = req.query;

    const topUsers = await User.find({ totalPoints: { $gt: 0 } })
      .select("name email totalPoints imgUrl")
      .sort({ totalPoints: -1 })
      .limit(Number(limit));

    res.status(200).json({
      
      success: true,
      data: topUsers.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        name: user.name,
        email: user.email,
        totalPoints: user.totalPoints || 0,
        imageUrl:user.imgUrl || ''
      }))
    });

  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching leaderboard" 
    });
  }
};
