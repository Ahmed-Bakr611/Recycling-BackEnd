import { Request, Response } from "express";
import Address from "../models/Address";
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

export const getAddresses = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user.userId;
  const addresses = await Address.find({ userId });
  res.json(addresses);
};

export const getAddressByUserId = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.params.id;
  const addresses = await Address.find({ userId });
  res.json(addresses);
};

export const getAllAddresses = async (req: Request, res: Response) => {
  try {
    const addresses = await Address.find(); // Optional: populate user info
    res.json(addresses);
  } catch (error) {
    console.error("Failed to get addresses:", error);
    res.status(500).json({ message: "Failed to retrieve addresses" });
  }
};
export const createAddress = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user.userId;
  const newAddress = new Address({ ...req.body, userId });
  await newAddress.save();
  res.status(201).json(newAddress);
};

export const updateAddress = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user.userId;
  const updated = await Address.findOneAndUpdate(
    { _id: req.params.id, userId },
    req.body,
    { new: true }
  );
  if (!updated) {
    return res.status(404).json({ message: "Address not found" });
  }
  res.json(updated);
};

export const deleteAddress = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user.userId;
  await Address.deleteOne({ _id: req.params.id, userId });
  res.status(204).end();
};
