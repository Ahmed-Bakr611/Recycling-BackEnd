import { Request, Response } from "express";
import User from "../models/users";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
  };
}

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.userId;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user.toSafeObject());
};


export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user.userId;

  const updates: any = {
    name: req.body.name,
    phoneNumber: req.body.phoneNumber,
  };

 
  if (req.file?.path) {
    updates.imgUrl = req.file.path;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true }
  );

  if (!updatedUser) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(updatedUser.toSafeObject());
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
