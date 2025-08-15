import { Request, Response } from "express";
import { getSocketIO } from "./socketServer";
import Category from "../models/category";
import { safeName } from "../utils/strings";

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
      // Normalize item payload: include slug and name object when available
  const rawName = safeName(item.name);
      io.emit("itemUpdated", {
        itemId: item._id,
        slug: item.slug || (rawName ? String(rawName).replace(/\s+/g, '-').toLowerCase() : undefined),
        categoryId: category._id,
        quantity: item.quantity,
        name: (typeof item.name === 'object') ? item.name : { en: rawName }
      });
    }

    return res.status(200).json({ item });
  } catch (error) {
    console.error("Error updating item quantity:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
