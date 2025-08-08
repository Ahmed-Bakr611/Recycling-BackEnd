import { Request, Response } from "express";
import { getSocketIO } from "./socketServer";
import Category from "../models/category";

export const updateItemQuantity = async (req: Request, res: Response) => {
  const { categoryId, itemId, newQuantity } = req.body;

  if (!categoryId || !itemId || typeof newQuantity !== "number") {
    return res.status(400).json({ error: "Missing or invalid parameters" });
  }

  try {
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Find the item inside the category's items array
    const item = category.items.id(itemId);

    if (!item) {
      return res.status(404).json({ error: "Item not found in category" });
    }

    // Update the quantity
    item.quantity = newQuantity;

    // Save the updated category
    await category.save();

    // Emit socket event
    const io = getSocketIO();
    if (io) {
      io.emit("itemUpdated", {
        itemId: item._id,
        categoryId: category._id,
        quantity: item.quantity,
      });
    }

    return res.status(200).json({ item });
  } catch (error) {
    console.error("Error updating item quantity:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
