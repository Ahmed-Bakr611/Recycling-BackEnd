
import Category from "../models/category";
import { IItem } from "../models/pickupOrder";
import { Types } from "mongoose";

type Operation = "increase" | "decrease";

export const updateItemQuantities = async (
  orderItems: IItem[],
  operation: Operation
) => {
  console.log(`🔄 Starting ${operation} operation for ${orderItems.length} order items`);
  
  for (let i = 0; i < orderItems.length; i++) {
    const orderItem = orderItems[i];
    console.log(`\n📦 Processing item ${i + 1}/${orderItems.length}: "${orderItem.itemName}"`);
    
    try {
      // Convert ObjectId to string for MongoDB query
      const categoryIdString = orderItem.categoryId.toString();
      console.log(`   🔍 Looking for category: ${categoryIdString}`);
      
      // Try to find category by ID
      let category = await Category.findById(categoryIdString);
      let targetItem = null;
      
      if (category) {
        console.log(`   ✅ Category found: "${category.name}"`);
        
        // Find item by name in this category
        targetItem = category.items.find(
          (item: any) => item.name.toLowerCase().trim() === orderItem.itemName.toLowerCase().trim()
        );
        
        if (targetItem) {
          console.log(`   ✅ Item found in expected category`);
        }
      }
      
      // FALLBACK: Search all categories if not found
      if (!targetItem) {
        console.log(`   🔍 Item not found in expected category, searching all...`);
        
        const categoriesWithItem = await Category.find({
          "items.name": { $regex: new RegExp(`^${orderItem.itemName}$`, 'i') }
        });
        
        if (categoriesWithItem.length > 0) {
          category = categoriesWithItem[0];
          targetItem = category.items.find(
            (item: any) => item.name.toLowerCase().trim() === orderItem.itemName.toLowerCase().trim()
          );
          
          console.log(`   ✅ Found in category: "${category.name}" (ID: ${category._id})`);
          console.log(`   ⚠️ Order had wrong categoryId: ${categoryIdString} → ${category._id}`);
        }
      }
      
      // CREATE MISSING ITEM if still not found
      if (!targetItem) {
        console.log(`   ⚠️ Creating missing item: "${orderItem.itemName}"`);
        
        // Find or create "Mixed Items" category
        let mixedCategory = await Category.findOne({ name: /mixed.?items/i });
        
        if (!mixedCategory) {
          mixedCategory = new Category({
            name: "Mixed Items",
            description: "Auto-created for orphaned items",
            image: "",
            items: []
          });
          await mixedCategory.save();
          console.log(`   📁 Created "Mixed Items" category`);
        }
        
        // Add the missing item
        mixedCategory.items.push({
          name: orderItem.itemName,
          image: orderItem.image || "",
          points: orderItem.points || 0,
          price: orderItem.price || 0,
          quantity: 0, // Start with 0
          measurement_unit: orderItem.measurement_unit || 1
        });
        
        await mixedCategory.save();
        category = mixedCategory;
        targetItem = category.items[category.items.length - 1];
        
        console.log(`   ✅ Created item in Mixed Items category`);
      }
      
      if (!targetItem) {
        throw new Error(`Could not find or create item "${orderItem.itemName}"`);
      }
      
      // UPDATE QUANTITY
      console.log(`   📊 Current quantity: ${targetItem.quantity}`);
      const originalQuantity = targetItem.quantity;
      
      if (operation === "increase") {
        targetItem.quantity += orderItem.quantity;
        console.log(`   📈 Increased: ${originalQuantity} + ${orderItem.quantity} = ${targetItem.quantity}`);
      } else if (operation === "decrease") {
        if (targetItem.quantity < orderItem.quantity) {
          throw new Error(`Not enough stock for ${targetItem.name}. Need: ${orderItem.quantity}, Have: ${targetItem.quantity}`);
        }
        targetItem.quantity -= orderItem.quantity;
        console.log(`   📉 Decreased: ${originalQuantity} - ${orderItem.quantity} = ${targetItem.quantity}`);
      }
      
      // SAVE
      await category.save();
      console.log(`   ✅ Saved successfully`);
      
    } catch (error) {
      console.error(`   ❌ Error processing "${orderItem.itemName}":`, error.message);
      throw error;
    }
  }
  
  console.log(`\n✅ All ${orderItems.length} items processed successfully`);
};