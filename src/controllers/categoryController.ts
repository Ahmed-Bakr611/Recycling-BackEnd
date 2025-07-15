import { Request, Response } from "express";
import { Types } from "mongoose";
import Category, { ICategory, ISubcategory } from "../models/category";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

export const createCategory = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const image = req.file?.path ?? "";

    const category = new Category({ name, image, subcategories: [] });
    await category.save();

    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};


export const getAllCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};


export const createCategoryWithImage = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { name, subName, points, unit } = req.body;

    const newCategory = new Category({
      name,
      image: req.file?.path ?? "", // صورة الكاتيجوري
      subcategories: [
        {
          name: subName,
          image: req.file?.path ?? "", // صورة الساب كاتيجوري (نفس الصورة مؤقتًا)
          points: Number(points),
          unit,
        },
      ],
    });

    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

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
    res.status(500).json({ message: (err as Error).message });
  }
};


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
    res.status(500).json({ message: (err as Error).message });
  }
};
