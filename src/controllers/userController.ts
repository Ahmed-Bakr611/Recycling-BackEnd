// controllers/userController.ts
import { Request, Response } from "express";
import User from "../models/users";
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select("-password -refreshToken");
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -refreshToken"
    );
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
