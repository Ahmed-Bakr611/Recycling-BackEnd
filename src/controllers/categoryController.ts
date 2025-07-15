import { Request, Response } from "express";
import { Types } from "mongoose";
import Category, { ICategory, IItem } from "../models/category";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

export const createCategory = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { name,description } = req.body;
    const image = req.file?.path ?? "";

    const category = new Category({ name, description ,image, items: [] });
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
    const { name, description, itemName, points, price, measurement_unit } = req.body;

    const newCategory = new Category({
      name,
      description,
      image: req.file?.path ?? "", 
      items: [
        {
          name: itemName,
          image: req.file?.path ?? "", 
          points: Number(points),
          price:Number(price),
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

export const addItem = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { itemName, points,price , measurement_unit } = req.body;

    if (!req.file) {
      res.status(400).json({ message:"required image" });
      return;
    }

    const item = {
      name: itemName,
      image: req.file.path,
      points: Number(points),
      price: Number(price),
      measurement_unit,
    };

    const updatedCategory = await Category.findOneAndUpdate(
      { name: categoryName },
      { $push: { items: item } },
      { new: true }
    );

    if (!updatedCategory) {
      res.status(404).json({ message: "Item Not Found" });
      return;
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};


export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const category = await Category.findOne({ name: categoryName });

    if (!category) {
      res.status(404).json({ message: "Items Not Found" });
      return;
    }

    res.status(200).json(category.items);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
