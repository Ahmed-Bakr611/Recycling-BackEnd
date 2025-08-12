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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter: any = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    // Execute queries
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select("-password -refreshToken")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
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
        limit: Number(limit),
      },
      filters: {
        role: role || null,
        search: search || null,
      },
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({
      success: false,
      message: "Server Error",
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
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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

export const addUserTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { gateway, type = "withdrawal", amount } = req.body;

    if (type === "withdrawal" && !gateway) {
      return res
        .status(400)
        .json({ message: "Gateway is required with withdrawl Method" });
    }
    // Validate type
    if (!["cashback", "withdrawal"].includes(type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    if (typeof amount !== "number" || isNaN(amount)) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Fetch user first to get current balance
    const userDoc = await User.findById(userId);
    if (!userDoc) return res.status(404).json({ message: "User not found" });

    const currentBalance = userDoc.attachments?.balance || 0;

    // Determine signed amount
    const signedAmount =
      type === "withdrawal" ? -Math.abs(amount) : Math.abs(amount);

    // Calculate new balance
    const newBalance = currentBalance + signedAmount;

    // Create transaction
    const transaction = {
      gateway,
      type,
      amount,
      date: new Date(),
    };

    // Update both balance and transactions
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $push: { "attachments.transactions": transaction },
        $set: { "attachments.balance": newBalance },
      },
      { new: true }
    ).select("-password -refreshToken");

    res.status(201).json({
      message: "Transaction added successfully",
      transaction,
      newBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET: Fetch all transactions for a user
export const getUserTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select(
      "attachments.transactions -_id"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.attachments.transactions || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};
