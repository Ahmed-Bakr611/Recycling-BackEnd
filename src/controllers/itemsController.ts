import { Request, Response } from "express";
import Category from "../models/category";
import translationService from "../utils/translationInstance"; // Use the singletonimport path from "path";


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

    const totalAggregation = await Category.aggregate([
      { $match: matchStage },
      { $project: { itemCount: { $size: "$items" } } },
      { $group: { _id: null, totalItems: { $sum: "$itemCount" } } },
    ]);
    const totalItems = totalAggregation[0]?.totalItems || 0;

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
    const { 
      itemName, 
      itemNameAr,
      points, 
      price, 
      measurement_unit, 
      quantity 
    } = req.body;

    if (!req.file) {
      res.status(400).json({ message: "Image is required" });
      return;
    }

    if (!quantity || isNaN(quantity)) {
      res.status(400).json({ 
        message: "Quantity is required and must be a number" 
      });
      return;
    }

    const item = {
      name: itemName || itemNameAr,
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

    // Add bilingual item translation
    console.log('🔄 Adding bilingual item translation');
    try {
      if (itemName && itemNameAr) {
        await translationService.addItemTranslation(
          categoryName,
          item.name,
          { en: itemName, ar: itemNameAr }
        );
      } else {
        await translationService.addItemTranslationSingle(categoryName, item.name);
      }
      console.log('✅ Bilingual item translation added successfully');
    } catch (translationError) {
      console.error('⚠️ Item translation failed:', translationError);
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    console.error('❌ Add item error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const updateItem = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryName, itemId } = req.params;
    const { 
      name, 
      nameAr,
      points, 
      price, 
      measurement_unit, 
      quantity 
    } = req.body;
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

    const oldName = item.name;

    // Update item fields
    if (name) item.name = name;
    if (points) item.points = Number(points);
    if (price) item.price = Number(price);
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (image) item.image = image;

    const unit = Number(measurement_unit);
    if (unit === 1 || unit === 2) {
      item.measurement_unit = unit;
    } else if (measurement_unit !== undefined) {
      res.status(400).json({ message: "measurement_unit must be 1 or 2" });
      return;
    }

    await category.save();

    // Update translation if name or Arabic name changed
    if (name || nameAr) {
      console.log('🔄 Updating bilingual item translation');
      try {
        const currentName = name || oldName; // Use new name if provided, otherwise keep old name
        const currentNameAr = nameAr || (await translationService.getItemTranslation(categoryName, oldName))?.ar || oldName;
        
        await translationService.updateItemTranslation(
          categoryName, 
          oldName, 
          currentName,
          { en: currentName, ar: currentNameAr }
        );
        console.log('✅ Bilingual item translation updated successfully');
      } catch (translationError) {
        console.error('⚠️ Item translation update failed:', translationError);
      }
    }

    res.status(200).json({ message: "Item updated successfully", item });
  } catch (err) {
    console.error("❌ Update item error:", err);
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

    const itemName = item.name;
    
    // Remove from database
    category.items.pull(itemId);
    await category.save();

    // Remove from translation files
    console.log('🔄 Removing item translation for:', itemName);
    try {
      await translationService.removeItemTranslation(categoryName, itemName);
      console.log('✅ Item translation removed successfully');
    } catch (translationError) {
      console.error('⚠️ Item translation removal failed:', translationError);
    }

    res.status(200).json({
      message: "Item deleted successfully",
      updatedCategory: category,
    });
  } catch (err) {
    console.error('❌ Delete item error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};