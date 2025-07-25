import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

export const createCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description } = req.body;
    const image = req.file?.path ?? "";

    const category = new Category({ name, description, image, items: [] });
    await category.save();

    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};

export const getAllCategories = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const createCategoryWithImage = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, itemName, points, price, measurement_unit } =
      req.body;

    const newCategory = new Category({
      name,
      description,
      image: req.file?.path ?? "",
      items: [
        {
          name: itemName,
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
        },
      ],
    });

    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
};
export const updatedCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { name, description, image: imageFromBody } = req.body;
    const imageFromFile = req.file?.path;

    const category = await Category.findOne({ name: categoryName });
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Update name and associated item names
    if (name) {
      category.name = name.toLowerCase();
      category.items.forEach((item) => {
        item.categoryName = name.toLowerCase();
      });
    }

    if (description) category.description = description;

    // ✅ Accept either uploaded file OR URL
    if (imageFromFile) {
      category.image = imageFromFile;
    } else if (imageFromBody) {
      category.image = imageFromBody;
    }

    const updated = await category.save();
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const deleted = await Category.findOneAndDelete({ name: categoryName });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
export const getCategoryByName = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;

    const category = await Category.findOne({ name: categoryName });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json(category);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
