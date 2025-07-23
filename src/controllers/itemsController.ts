import { Request, Response } from "express";
import Item from "../models/item";
interface MulterRequest extends Request {
  file: Express.Multer.File;
}
// ======================== ITEM ========================
export const getAllItems = async (_req: Request, res: Response) => {
  try {
    //get all items properties with select => catergoy {name,image}
    const items = await Item.find().populate("categoryId", "name image");
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getItemsByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const items = await Item.find({ categoryId }).populate(
      "categoryId",
      "name"
    );

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
export const getItemsByName = async (req: Request, res: Response) => {
  try {
    const { itemName } = req.params;

    const items = await Item.find({
      name: { $regex: new RegExp(`^${itemName}$`, "i") },
    }).populate("categoryId", "name");

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const createItem = async (req: MulterRequest, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { name, points, price, quantity, measurement_unit } = req.body;
    const image = req.file?.path ?? "";

    const item = new Item({
      name,
      points: Number(points),
      price: Number(price),
      quantity: Number(quantity),
      measurement_unit: Number(measurement_unit),
      image,
      categoryId,
    });

    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const updateItem = async (req: MulterRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const { name, points, price, quantity, measurement_unit } = req.body;
    const image = req.file?.path;

    const updateData: any = {
      ...(name && { name }),
      ...(points && { points: Number(points) }),
      ...(price && { price: Number(price) }),
      ...(quantity && { quantity: Number(quantity) }),
      ...(measurement_unit && { measurement_unit: Number(measurement_unit) }),
      ...(image && { image }),
    };

    const updated = await Item.findByIdAndUpdate(itemId, updateData, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Item not found" });

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const deleted = await Item.findByIdAndDelete(itemId);

    if (!deleted) return res.status(404).json({ message: "Item not found" });
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
