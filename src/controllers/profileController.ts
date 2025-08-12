import { Request, Response } from "express";
import User from "../models/users";


interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
  };
}

// === GET /profile ===
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.userId;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user.toSafeObject());
};

// === PUT /profile ===
// This supports multipart/form-data (e.g., name, phoneNumber, image)
export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  
  try {
    const userId = req.user.userId;
    console.log("Updating profile for userId:", userId);
console.log("Body:", req.body);
console.log("File:", req.file);
console.log("User role:", req.user.role);


    const updates: any = {
      name: req.body.name,
      phoneNumber: req.body.phoneNumber,
    };

    if (req.file?.path) {
      if (req.user.role === "delivery") {
        updates["attachments.deliveryImage"] = req.file.path;
      } else {
        updates.imgUrl = req.file.path;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(updatedUser.toSafeObject());
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};



// === DELETE /profile ===
export const deleteProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user.userId;

  const deleted = await User.findByIdAndDelete(userId);
  if (!deleted) {
    return res
      .status(404)
      .json({ message: "User not found or already deleted" });
  }

  res.status(204).end();
};
