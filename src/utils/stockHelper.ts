import { ICartItem } from "models/cart";
import Category from "../models/category";
import { IItem } from "../models/pickupOrder";
import mongoose, { Types } from "mongoose";
import { getSocketIO } from "../socket/socketServer";

type Operation = "increase" | "decrease";

export const updateItemQuantities = async (
  orderItems: IItem[],
  operation: Operation
) => {
  console.log("-----------UPDATE STOCK NOW------------------------------");
  console.log(
    `🔄 Starting ${operation} operation for ${orderItems.length} items`
  );

  const io = getSocketIO();
  await Promise.all(
    orderItems.map(async (orderItem, index) => {
      const categoryId = new mongoose.Types.ObjectId(orderItem.categoryId);
      const itemId = new mongoose.Types.ObjectId(orderItem._id);
      
      try {
        const category = await Category.findById(categoryId);
        if (!category) throw new Error("Category not found");
        
        const item = category.items.id(itemId);
        if (!item) throw new Error("Item not found in category");
        
        if (operation === "decrease" && item.quantity < orderItem.quantity) {
          // Use bilingual display name if available
          const displayName = item.name?.en || item.name || "Unknown item";
          throw new Error(
            `❌ Not enough stock for "${displayName}". Need: ${orderItem.quantity}, Have: ${item.quantity}`
          );
        }
        
        const quantityChange =
          operation === "increase" ? orderItem.quantity : -orderItem.quantity;
        
        // Apply the change
        await Category.updateOne(
          { _id: categoryId, "items._id": itemId },
          { $inc: { "items.$.quantity": quantityChange } }
        );
        
        // Emit real-time update
        if (io) {
          console.log("SOCKET SENDING NOW FROM SERVER 👋👋👋👋👋👋👋👋");
          const newQuantity = item.quantity + quantityChange;
          io.emit("itemUpdated", {
            itemId: item._id,
            categoryId: category._id,
            quantity: newQuantity,
          });
        }
        
        const displayName = item.name?.en || item.name || "Unknown item";
        console.log(
          `✅ ${operation === "increase" ? "Added" : "Subtracted"} ${
            orderItem.quantity
          } → "${displayName}"`
        );
      } catch (error: any) {
        const displayName = orderItem.itemName?.en || orderItem.itemName || "Unknown item";
        console.error(
          `❌ Error updating item ${index + 1} (${displayName}):`,
          error.message
        );
        throw error;
      }
    })
  );
  console.log(`\n✅ All ${orderItems.length} items processed successfully.`);
};

export function mapCartItemsToOrderItems(cartItems: ICartItem[]): IItem[] {
  return cartItems.map((item) => ({
    _id: new mongoose.Types.ObjectId(item._id),
    categoryId: new mongoose.Types.ObjectId(item.categoryId),
    categoryName: item.categoryName, // Already bilingual
    itemName: item.name, // Already bilingual
    image: item.image,
    points: item.points,
    price: item.price,
    measurement_unit: item.measurement_unit as 1 | 2,
    quantity: item.quantity,
  }));
}