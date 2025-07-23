import { Request, Response } from "express";
import Category from "../models/category";
import Item from "../models/item";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// ======================== CATEGORY ========================
export const getAllCategories = async (_req: Request, res: Response) => {
  console.log("HIT ME CATEGORIES");
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const createCategory = async (req: MulterRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const image = req.file?.path ?? "";
    const category = new Category({ name, description, image });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const updateCategory = async (req: MulterRequest, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { name, description } = req.body;
    const image = req.file?.path;

    const updateData: any = {
      ...(name && { name }),
      ...(description && { description }),
      ...(image && { image }),
    };
    const updated = await Category.findByIdAndUpdate(categoryId, updateData, {
      new: true,
    });

    if (!updated)
      return res.status(404).json({ message: "Category not found" });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const deleted = await Category.findByIdAndDelete(categoryId);

    if (!deleted)
      return res.status(404).json({ message: "Category not found" });

    // Optionally delete items that belong to this category
    await Item.deleteMany({ categoryId });

    res.status(200).json({ message: "Category and its items deleted" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
