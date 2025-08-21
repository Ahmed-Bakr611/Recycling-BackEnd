import { Request, Response } from "express";
import Category from "../models/category";
import translationService from "../utils/translationInstance";
import { IBilingualText } from "../models/item";
import mongoose from "mongoose";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// Utility function to create bilingual text object
const createBilingualText = (en: string, ar?: string): IBilingualText => {
  return {
    en: en,
    ar: ar || en // Fallback to English if Arabic not provided
  };
};

export const getAllItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const role = req.query.role;
    const language = req.query.language as 'en' | 'ar' || 'en';
    const categoryName = req.query.category as string;
  const allFlag = req.query.all === 'true';

    let matchStage = {};
    if (categoryName && categoryName !== 'all') {
      matchStage = { "name.en": categoryName };
    }

    const totalAggregation = await Category.aggregate([
      { $match: matchStage },
      { $project: { itemCount: { $size: "$items" } } },
      { $group: { _id: null, totalItems: { $sum: "$itemCount" } } },
    ]);
    const totalItems = totalAggregation[0]?.totalItems || 0;

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: matchStage },
      { $unwind: "$items" },
    ];
    if (!allFlag) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    }
    pipeline.push({
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
    });

    let items = await Category.aggregate(pipeline) as Array<Record<string, any>>;

    // Transform items with language-specific display names
    const transformedItems = items.map(item => {
      const result: any = {
        ...item,
        displayName: item.name?.[language] || item.name?.en || item.name,
        categoryDisplayName: item.categoryName?.[language] || item.categoryName?.en || item.categoryName
      };
      if (role === "buyer") {
        result.price = item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price;
      }
      return result;
    });

    if (allFlag) {
      res.status(200).json({ items: transformedItems, total: totalItems });
    } else {
      res.paginated(transformedItems, totalItems);
    }
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
    const language = req.query.language as 'en' | 'ar' || 'en';
    const search = req.query.search as string;

    // Find category by English name
    const category = await Category.findOne({ "name.en": categoryName });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Get all items from this category
    let allItems = Array.isArray(category.items) ? category.items : [];

    // Apply search filter if search term exists
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      allItems = allItems.filter(item => {
        const nameEn = item.name?.en?.toLowerCase() || '';
        const nameAr = item.name?.ar?.toLowerCase() || '';
        return nameEn.includes(searchTerm) || nameAr.includes(searchTerm);
      });
    }

    // Get total count after filtering
    const totalItems = allItems.length;

    // Apply pagination to filtered results
    const paginatedItems = allItems.slice(skip, skip + limit);

    // Transform items
    let items = paginatedItems.map(item => {
      const obj = item.toObject ? item.toObject() : { ...item };
      return {
        ...obj,
        categoryId: category._id,
        categoryName: category.name,
        displayName: obj.name?.[language] || obj.name?.en || obj.name,
        categoryDisplayName: category.name[language] || category.name.en,
      };
    });
      
    if (role === "buyer") {
      items = items.map(item => ({
        ...item,
        price: item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price
      }));
    }

    res.paginated(items, totalItems);
  } catch (err) {
    console.error("getItems error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};
// Add this new function to your items controller file

export const getItemsByIds = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { itemIds, userRole } = req.body;
    const language = req.query.language as 'en' | 'ar' || 'en';

    // Validate input
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ 
        message: 'itemIds array is required',
        success: false 
      });
      return;
    }

    // Validate itemIds are valid MongoDB ObjectIds
    const validItemIds = itemIds.filter(id => 
      typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
    );

    if (validItemIds.length === 0) {
      res.status(400).json({ 
        message: 'No valid item IDs provided',
        success: false 
      });
      return;
    }

    // Convert string IDs to ObjectIds
    const objectIds = validItemIds.map(id => new mongoose.Types.ObjectId(id));

    // Find items across all categories using aggregation
    const items = await Category.aggregate([
      { $unwind: '$items' },
      {
        $match: {
          'items._id': { $in: objectIds }
        }
      },
      {
        $project: {
          _id: '$items._id',
          name: '$items.name',
          points: '$items.points',
          price: '$items.price',
          measurement_unit: '$items.measurement_unit',
          image: '$items.image',
          quantity: '$items.quantity',
          categoryName: '$name',
          categoryId: '$_id',
        }
      }
    ]);

    // Transform items with language-specific display names and role-based pricing
    const transformedItems = items.map(item => {
      const result: any = {
        ...item,
        displayName: item.name?.[language] || item.name?.en || item.name,
        categoryDisplayName: item.categoryName?.[language] || item.categoryName?.en || item.categoryName
      };

      // Apply buyer pricing (1.5x markup)
      if (userRole === "buyer") {
        result.price = item.price ? Math.round(item.price * 1.5 * 100) / 100 : item.price;
      }

      return result;
    });

    res.status(200).json({
      data: transformedItems,
      success: true,
    });

  } catch (error) {
    console.error('Error fetching items by IDs:', error);
    res.status(500).json({
      message: 'Internal server error',
      success: false,
    });
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

    if (!itemName) {
      res.status(400).json({ message: "English item name is required" });
      return;
    }

    if (!quantity || isNaN(quantity)) {
      res.status(400).json({ 
        message: "Quantity is required and must be a number" 
      });
      return;
    }

    const item = {
      name: createBilingualText(itemName, itemNameAr),
      image: req.file.path,
      points: Number(points),
      price: Number(price),
      quantity: Number(quantity),
      measurement_unit: Number(measurement_unit),
    };

    // Find category by English name
    const updatedCategory = await Category.findOneAndUpdate(
      { "name.en": categoryName },
      { $push: { items: item } },
      { new: true }
    );

    if (!updatedCategory) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Add item translation to files for backward compatibility
    console.log('🔄 Adding bilingual item translation to files');
    try {
      await translationService.addItemTranslation(
        categoryName,
        item.name.en, // Use English name as key
        { en: item.name.en, ar: item.name.ar }
      );
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

    // Find category by English name
    const category = await Category.findOne({ "name.en": categoryName });
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const oldNameEn = item.name.en;

    // Update item fields
    if (name) item.name.en = name;
    if (nameAr) item.name.ar = nameAr;
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

    // Update translation in files if name changed
    if (name || nameAr) {
      console.log('🔄 Updating bilingual item translation in files');
      try {
        const newNameEn = name || oldNameEn;
        
        await translationService.updateItemTranslation(
          categoryName, 
          oldNameEn, 
          newNameEn,
          { en: item.name.en, ar: item.name.ar }
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
    
    // Find category by English name
    const category = await Category.findOne({ "name.en": categoryName });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const item = category.items.id(itemId);
    if (!item) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const itemNameEn = item.name.en;
    
    // Remove from database
    category.items.pull(itemId);
    await category.save();

    // Remove from translation files
    console.log('🔄 Removing item translation for:', itemNameEn);
    try {
      await translationService.removeItemTranslation(categoryName, itemNameEn);
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

interface OldCategory {
  _id: any;
  name: string | { en: string; ar?: string };
  description: string | { en: string; ar?: string };
  items: Array<{
    [key: string]: any; 
    _id: any; 
    name: string | { en: string; ar?: string }; 
  }>;
  [key: string]: any;
}

interface OldItem {
  _id: any;
  name: string | { en: string; ar?: string };
  [key: string]: any;
}

// export const migrateToBilingual = async (req: Request, res: Response): Promise<void> => {
//   try {
//     // Debug logging
//     console.log('📋 Request details:');
//     console.log('Headers:', req.headers);
//     console.log('Content-Type:', req.get('Content-Type'));
//     console.log('Raw body:', req.body);
//     console.log('Body type:', typeof req.body);
//     console.log('Body keys:', req.body ? Object.keys(req.body) : 'No body');

//     // Check if body exists
//     if (!req.body) {
//       res.status(400).json({
//         error: 'No request body found',
//         message: 'Make sure to send JSON data in the request body',
//         debug: {
//           contentType: req.get('Content-Type'),
//           bodyExists: !!req.body,
//           bodyType: typeof req.body
//         }
//       });
//       return;
//     }

//     const { action, confirm } = req.body;

//     // Safety check - require confirmation
//     if (confirm !== 'YES_MIGRATE_DATA') {
//       res.status(400).json({
//         error: 'Migration requires confirmation',
//         message: 'Send { "action": "migrate", "confirm": "YES_MIGRATE_DATA" } to proceed',
//         warning: 'This will modify your database structure. Make sure you have a backup!',
//         received: { action, confirm }
//       });
//       return;
//     }

//     if (action !== 'migrate') {
//       res.status(400).json({
//         error: 'Invalid action',
//         validActions: ['migrate'],
//         received: action
//       });
//       return;
//     }

//     console.log('🔄 Starting migration to bilingual format via API...');

//     // Get all existing categories
//     const categories = await mongoose.connection.db
//       .collection('categories')
//       .find({})
//       .toArray() as OldCategory[];

//     console.log(`📊 Found ${categories.length} categories to migrate`);

//     let migratedCategoriesCount = 0;
//     let migratedItemsCount = 0;
//     const migrationLog: string[] = [];
//     const errors: string[] = [];

//     for (const category of categories) {
//       try {
//         migrationLog.push(`\n🔄 Migrating category: ${JSON.stringify(category.name)}`);

//         // Prepare the updated category
//         const updatedCategory: any = { ...category };
//         let categoryChanged = false;

//         // Convert category name to bilingual format
//         if (typeof category.name === 'string') {
//           updatedCategory.name = {
//             en: category.name,
//             ar: category.name // Fallback to English
//           };
//           migrationLog.push(`  ✓ Converted string name "${category.name}" to bilingual format`);
//           categoryChanged = true;
//         } else if (typeof category.name === 'object' && category.name.en) {
//           updatedCategory.name = {
//             en: category.name.en,
//             ar: category.name.ar || category.name.en
//           };
//           migrationLog.push(`  ✓ Enhanced existing object name structure`);
//           if (!category.name.ar) categoryChanged = true;
//         } else {
//           const errorMsg = `Unexpected name format for category ${category._id}: ${JSON.stringify(category.name)}`;
//           errors.push(errorMsg);
//           migrationLog.push(`  ❌ ${errorMsg}`);
//           continue;
//         }

//         // Convert category description to bilingual format
//         if (typeof category.description === 'string') {
//           updatedCategory.description = {
//             en: category.description,
//             ar: category.description // Fallback to English
//           };
//           migrationLog.push(`  ✓ Converted description to bilingual format`);
//           categoryChanged = true;
//         } else if (typeof category.description === 'object' && category.description?.en) {
//           updatedCategory.description = {
//             en: category.description.en,
//             ar: category.description.ar || category.description.en
//           };
//           migrationLog.push(`  ✓ Enhanced existing description structure`);
//           if (!category.description.ar) categoryChanged = true;
//         } else if (!category.description) {
//           // Handle missing description
//           updatedCategory.description = {
//             en: `${updatedCategory.name.en} category`,
//             ar: `${updatedCategory.name.ar} category`
//           };
//           migrationLog.push(`  ✓ Added default bilingual description`);
//           categoryChanged = true;
//         }

//         // Convert item names to bilingual format
//         let itemsChanged = false;
//         if (category.items && Array.isArray(category.items)) {
//           updatedCategory.items = category.items.map((item: OldItem, index: number) => {
//             const updatedItem = { ...item };
//             let itemChanged = false;
            
//             if (typeof item.name === 'string') {
//               updatedItem.name = {
//                 en: item.name,
//                 ar: item.name // Fallback to English
//               };
//               migrationLog.push(`    ✓ Item ${index + 1}: Converted "${item.name}" to bilingual`);
//               itemChanged = true;
//               migratedItemsCount++;
//             } else if (typeof item.name === 'object' && item.name?.en) {
//               updatedItem.name = {
//                 en: item.name.en,
//                 ar: item.name.ar || item.name.en
//               };
//               migrationLog.push(`    ✓ Item ${index + 1}: Enhanced existing bilingual structure`);
//               if (!item.name.ar) {
//                 itemChanged = true;
//                 migratedItemsCount++;
//               }
//             } else if (!item.name) {
//               // Handle items with missing names
//               updatedItem.name = {
//                 en: `Item ${index + 1}`,
//                 ar: `Item ${index + 1}`
//               };
//               migrationLog.push(`    ✓ Item ${index + 1}: Added default bilingual name`);
//               itemChanged = true;
//               migratedItemsCount++;
//             } else {
//               migrationLog.push(`    ⚠️ Item ${index + 1}: Unexpected name format: ${JSON.stringify(item.name)}`);
//             }

//             if (itemChanged) itemsChanged = true;
//             return updatedItem;
//           });
          
//           migrationLog.push(`  📦 Processed ${category.items.length} items (${updatedCategory.items.filter((item: any) => typeof item.name === 'object').length} migrated)`);
//         } else {
//           migrationLog.push(`  📦 No items found in this category`);
//         }

//         // Only update if something changed
//         if (categoryChanged || itemsChanged) {
//           // Update the category in database
//           await mongoose.connection.db
//             .collection('categories')
//             .replaceOne({ _id: category._id }, updatedCategory);
          
//           migratedCategoriesCount++;
//           migrationLog.push(`✅ Successfully migrated category: ${updatedCategory.name.en}`);

//           // Update translation files if category names changed
//           if (categoryChanged) {
//             try {
//               await translationService.addCategoryTranslation(
//                 updatedCategory.name.en,
//                 { en: updatedCategory.name.en, ar: updatedCategory.name.ar },
//                 { en: updatedCategory.description.en, ar: updatedCategory.description.ar }
//               );

//               // Add item translations to files
//               if (updatedCategory.items && Array.isArray(updatedCategory.items)) {
//                 for (const item of updatedCategory.items) {
//                   if (item.name && typeof item.name === 'object') {
//                     await translationService.addItemTranslation(
//                       updatedCategory.name.en,
//                       item.name.en,
//                       { en: item.name.en, ar: item.name.ar }
//                     );
//                   }
//                 }
//               }

//               migrationLog.push(`  ✅ Translation files updated for category and ${updatedCategory.items?.length || 0} items`);
//             } catch (translationError) {
//               migrationLog.push(`  ⚠️ Translation file update failed: ${translationError}`);
//             }
//           }
//         } else {
//           migrationLog.push(`  ℹ️ Category already in bilingual format, skipping`);
//         }

//       } catch (error) {
//         const errorMsg = `Failed to migrate category ${category._id}: ${error}`;
//         errors.push(errorMsg);
//         migrationLog.push(`❌ ${errorMsg}`);
//         console.error(errorMsg);
//       }
//     }

//     // Verify migration
//     migrationLog.push('\n🔍 Verifying migration...');
//     const verificationCategory = await Category.findOne({});
//     let verificationData = {};
    
//     if (verificationCategory) {
//       const sampleItem = verificationCategory.items.length > 0 ? verificationCategory.items[0] : null;
//       verificationData = {
//         sampleCategoryStructure: {
//           name: verificationCategory.name,
//           description: verificationCategory.description,
//           itemsCount: verificationCategory.items.length,
//           sampleItemName: sampleItem ? sampleItem.name : null
//         }
//       };
//       migrationLog.push('✅ Verification successful - sample data structure looks correct');
//     } else {
//       migrationLog.push('⚠️ No categories found for verification');
//     }

//     // Generate detailed summary
//     const totalItems = categories.reduce((acc, cat) => acc + (cat.items?.length || 0), 0);
    
//     const result = {
//       success: true,
//       message: `Migration completed! ${migratedCategoriesCount}/${categories.length} categories and ${migratedItemsCount}/${totalItems} items migrated successfully`,
//       summary: {
//         categories: {
//           total: categories.length,
//           migrated: migratedCategoriesCount,
//           successRate: `${((migratedCategoriesCount / categories.length) * 100).toFixed(1)}%`
//         },
//         items: {
//           total: totalItems,
//           migrated: migratedItemsCount,
//           successRate: totalItems > 0 ? `${((migratedItemsCount / totalItems) * 100).toFixed(1)}%` : '0%'
//         },
//         errors: {
//           count: errors.length,
//           list: errors
//         }
//       },
//       migrationLog,
//       verificationData
//     };

//     console.log(`🎉 Migration completed!`);
//     console.log(`   Categories: ${migratedCategoriesCount}/${categories.length}`);
//     console.log(`   Items: ${migratedItemsCount}/${totalItems}`);
    
//     res.status(200).json(result);

//   } catch (error) {
//     console.error('❌ Migration failed:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Migration failed',
//       message: error instanceof Error ? error.message : 'Unknown error occurred',
//       details: 'Check server logs for more information'
//     });
//   }
// };



export const getItemByName = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { itemName } = req.params;
    const language = req.query.language as 'en' | 'ar' || 'en';
    const role = req.query.role as string;

    if (!itemName) {
      res.status(400).json({ message: "Item name is required" });
      return;
    }

    // Search for item by name across all categories
    const result = await Category.aggregate([
      { $unwind: '$items' },
      {
        $match: {
          $or: [
            { 'items.name.en': { $regex: new RegExp(`^${itemName}$`, 'i') } },
            { 'items.name.ar': { $regex: new RegExp(`^${itemName}$`, 'i') } }
          ]
        }
      },
      {
        $project: {
          _id: '$items._id',
          name: '$items.name',
          points: '$items.points',
          price: '$items.price',
          measurement_unit: '$items.measurement_unit',
          image: '$items.image',
          quantity: '$items.quantity',
          categoryName: '$name',
          categoryId: '$_id',
        }
      },
      { $limit: 1 } // Get only the first match
    ]);

    if (result.length === 0) {
      res.status(404).json({ message: "Item not found" });
      return;
    }

    const item = result[0];

    // Transform item with language-specific display names
    const transformedItem = {
      ...item,
      displayName: item.name?.[language] || item.name?.en || item.name,
      categoryDisplayName: item.categoryName?.[language] || item.categoryName?.en || item.categoryName,
      price: role === "buyer" && item.price 
        ? Math.round(item.price * 1.5 * 100) / 100 
        : item.price
    };

    res.status(200).json({
      success: true,
      data: transformedItem
    });
  } catch (err) {
    console.error("getItemByName error:", err);
    res.status(500).json({ message: (err as Error).message });
  }
};