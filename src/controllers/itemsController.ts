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
const calculatePriceWithMarkup = (originalPrice: number, userRole?: string): number => {
  if (!userRole) return originalPrice;
  
  // Define your markup percentages based on role
  const markupRates: { [key: string]: number } = {
    'buyer': 0.20,      // 15% markup for buyers
    'premium': 0.10,    // 10% markup for premium users
    'wholesale': 0.05,  // 5% markup for wholesale
    'admin': 0,         // No markup for admin
    // Add other roles as needed
  };
  
  const markupRate = markupRates[userRole.toLowerCase()] || 0;
  return Math.round((originalPrice * (1 + markupRate)) * 100) / 100; // Round to 2 decimal places
};
const applyRoleBasedPricing = (items: any[], userRole?: string) => {
  return items.map(item => ({
    ...item,
    originalPrice: item.price, // Keep original price for reference
    price: calculatePriceWithMarkup(item.price, userRole), // Update price with markup
  }));
};

export const getAllItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const userRole = req.query.userRole as string; // Get user role from query params
    
    // 1. First get total item count
    const totalResult = await Category.aggregate([
      { $project: { itemCount: { $size: "$items" } } },
      { $group: { _id: null, totalItems: { $sum: "$itemCount" } } },
    ]);
    const totalItems = totalResult[0]?.totalItems || 0;

    // 2. Get paginated items with category info
    const items = await Category.aggregate([
      { $unwind: "$items" }, // Flatten items
      { $skip: skip }, // Skip at item level
      { $limit: limit }, // Limit at item level
      {
        $project: {
          _id: "$items._id",
          name: "$items.name",
          points: "$items.points",
          price: "$items.price",
          measurement_unit: "$items.measurement_unit",
          image: "$items.image",
          quantity: "$items.quantity",
          // Add any other item fields you have

          // Add category info
          categoryName: "$name",
          categoryId: "$_id",
        },
      },
    ]);

    // Apply role-based pricing
    const itemsWithPricing = applyRoleBasedPricing(items, userRole);

    res.paginated(itemsWithPricing, totalItems);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const { skip, limit } = req.pagination;
    const userRole = req.query.userRole as string; // Get user role from query params

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

    // Apply role-based pricing to category items
    const itemsWithPricing = applyRoleBasedPricing(category.items, userRole);

    res.paginated(itemsWithPricing, totalItems);
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
