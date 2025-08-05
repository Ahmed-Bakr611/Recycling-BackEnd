import { Request, Response } from "express";
import Category from "../models/category";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}
// ======================== ITEM ========================
// export const getAllItems = async (
//   _req: Request,
//   res: Response
// ): Promise<void> => {
//   console.log("HITTTTTTTTTTTT");
//   try {
//     const categories = await Category.find();
//     const items = categories.flatMap((cat) =>
//       cat.items.map((item) => ({
//         ...item.toObject(),
//         categoryName: cat.name,
//         categoryId: cat._id,
//       }))
//     );
//     res.status(200).json({ items });
//   } catch (err) {
//     res.status(500).json({ message: (err as Error).message });
//   }
// };

// export const getItems = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { categoryName } = req.params;
//     const category = await Category.findOne({ name: categoryName });

//     if (!category) {
//       res.status(404).json({ message: "Category not found" });
//       return;
//     }

//     res.status(200).json(category.items);
//   } catch (err) {
//     res.status(500).json({ message: (err as Error).message });
//   }
// };

export const getAllItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const role = req.query.role;
    const categoryName = req.query.category as string;

    let matchStage = {};

    if (categoryName && categoryName !== 'all') {
      matchStage = { name: categoryName };
    }

    // 1. Count total items
    const totalAggregation = await Category.aggregate([
      { $match: matchStage },
      { $project: { itemCount: { $size: "$items" } } },
      { $group: { _id: null, totalItems: { $sum: "$itemCount" } } },
    ]);
    const totalItems = totalAggregation[0]?.totalItems || 0;

    // 2. Paginate items within matched categories
    let items = await Category.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: "$items._id",
          name: "$items.name",
          points: "$items.points",
          price: "$items.price",
          measurement_unit: "$items.measurement_unit",
          image: "$items.image",
          quantity: "$items.quantity",
          categoryName: "$name",
          categoryId: "$_id",
        },
      },
    ]) as Array<Record<string, any>>;

    // 3. Adjust price if role is buyer
    if (role === "buyer") {
      items = items.map(item => ({
        ...item,
        price: item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price
      }));
    }

    res.paginated(items, totalItems);
  } catch (err) {
    console.error("getAllItems error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { skip, limit } = req.pagination;
    const role = req.query.role;

    const category = await Category.findOne({ name: categoryName }).slice(
      "items",
      [skip, limit]
    ); // MongoDB array slicing

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Get total items count in this category
    const fullCategory = await Category.findOne({ name: categoryName });
    const totalItems = fullCategory?.items.length || 0;

    let items = Array.isArray(category.items)
      ? category.items.map(item => {
          const obj = item.toObject ? item.toObject() : { ...item };
          return {
            ...obj,
            categoryId: category._id, // Add categoryId here
            categoryName: category.name, // Add categoryName here
          };
        })
      : [];
    if (role === "buyer") {
      items = items.map(item => ({
        ...item,
        price: item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price
      }));
    }

    res.paginated(items, totalItems);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const addItem = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { itemName, points, price, measurement_unit, quantity } = req.body;

    if (!req.file) {
      res.status(400).json({ message: "Image is required" });
      return;
    }

    if (!quantity || isNaN(quantity)) {
      res
        .status(400)
        .json({ message: "Quantity is required and must be a number" });
      return;
    }

    const item = {
      name: itemName,
      image: req.file.path,
      points: Number(points),
      price: Number(price),
      quantity: Number(quantity),
      measurement_unit: Number(measurement_unit),
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

export const updateItem = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const { name, points, price, measurement_unit, quantity } = req.body;
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
    if (quantity !== undefined) item.quantity = Number(quantity);

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

export const deleteItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
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

    category.items.pull(itemId);
    await category.save();

    res.status(200).json({
      message: "Item deleted successfully",
      updatedCategory: category,
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};