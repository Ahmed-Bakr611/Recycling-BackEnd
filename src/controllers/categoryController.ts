import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";


interface MulterRequest extends Request {
  file: Express.Multer.File;
}

export const getAllItems = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find();
    const items = categories.flatMap((cat) =>
      cat.items.map((item) => ({
        ...item.toObject(),
        categoryName: cat.name,
        categoryId: cat._id,
      }))
    );
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const createCategory = async (req: MulterRequest, res: Response): Promise<void> => {
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

export const addItem = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { itemName, points, price, measurement_unit } = req.body;

    if (!req.file) {
      res.status(400).json({ message: "Image is required" });
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
      res.status(404).json({ message: "Category not found" });
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
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json(category.items);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};
export const updatedCategory = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { name, description, image: imageFromBody } = req.body;
    const imageFromFile = req.file?.path;

    const image = imageFromBody || imageFromFile;

    const updateData: Partial<ICategory> = {
      ...(name && { name }),
      ...(description && { description }),
      ...(image && { image }),
    };

    const updated = await Category.findOneAndUpdate(
      { name: categoryName },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ message: "Category not updated" });
      return;
    }

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};


export const getCategoryByName = async (req: Request, res: Response): Promise<void> => {
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


export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
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

export const updateItem = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const { name, points, price, measurement_unit } = req.body;
    const image = req.file?.path;

    const category = await Category.findOne({ name: categoryName });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    if (name) item.name = name;
    if (points) item.points = Number(points);
    if (price) item.price = Number(price);

    const unit = Number(measurement_unit);
    if (unit === 1 || unit === 2) {
      item.measurement_unit = unit;
    } else if (measurement_unit !== undefined) {
      res.status(400).json({ message: "measurement_unit must be 1 or 2" });
      return;
    }

    if (image) item.image = image;

    await category.save();

    res.status(200).json({ message: "Item updated successfully", item });
  } catch (err) {
    console.error("Update item error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};


export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;

    const category = await Category.findOne({ name: categoryName });
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const itemIndex = category.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

 
    category.items.splice(itemIndex, 1);

    await category.save();

    res.status(200).json({
      message: "Item deleted successfully",
      updatedCategory: category,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).message });
  }
};

