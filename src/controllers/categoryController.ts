import { Request, Response } from "express";
import { Types } from "mongoose";
import Category, { ICategory, ISubcategory } from "../models/category";

// 👇 تعريف نوع خاص بـ Multer Request
interface MulterRequest extends Request {
  file: Express.Multer.File;
}

/**
 * 1️⃣ Create a category (name only)
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = new Category({ name: req.body.name });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

/**
 * 2️⃣ Get all categories
 */
export const getAllCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

/**
 * 3️⃣ Create a category with a first sub‑category (and image)
 */
export const createCategoryWithImage = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    console.log("✅ image arrive successfully", req.file);

    const { name, subName, points, unit } = req.body;

    const newCategory = new Category({
      name,
      subcategories: [
        {
          name: subName,
          image: req.file?.path ?? "",
          points: Number(points),
          unit,
        },
      ],
    });

    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (err) {
    console.error("❌ Error:", (err as Error).message);
    res.status(400).json({ message: (err as Error).message });
  }
};

/**
 * 4️⃣ Add a sub‑category to an existing category
 */
export const addSubcategory = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { subName, points, unit } = req.body;

    if (!req.file) {
      res.status(400).json({ message: "الصورة مطلوبة" });
      return;
    }

    const sub: ISubcategory = {
      name: subName,
      image: req.file.path,
      points: Number(points),
      unit,
    };

    const updatedCategory = await Category.findOneAndUpdate(
      { name: categoryName },
      { $push: { subcategories: sub } },
      { new: true }
    );

    if (!updatedCategory) {
      res.status(404).json({ message: "لم يتم العثور على الكاتيجوري" });
      return;
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    console.error("❌ Error:", (err as Error).message);
    res.status(500).json({ message: (err as Error).message });
  }
};

/**
 * 5️⃣ Get sub‑categories for a given category
 */
export const getSubcategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;

    const category = await Category.findOne({ name: categoryName });

    if (!category) {
      res.status(404).json({ message: "الفئة غير موجودة" });
      return;
    }

    res.status(200).json(category.subcategories);
  } catch (err) {
    console.error("❌ Error:", (err as Error).message);
    res.status(500).json({ message: (err as Error).message });
  }
};
