import { ICartItem } from "models/cart";
import Category from "../models/category";
import { IItem } from "../models/pickupOrder";
import mongoose, { Types } from "mongoose";

type Operation = "increase" | "decrease";

export const updateItemQuantities = async (
  orderItems: IItem[],
  operation: Operation
) => {
  console.log("-----------UPDATE STOCK NOW------------------------------");
  console.log(
    `🔄 Starting ${operation} operation for ${orderItems.length} items`
  );
  console.log("------------START DISPLAY INCOMING ITEMS---------------------");
  console.log(orderItems);
  console.log("-------------END DISPLAY INCOMINE ITEMS-----------------");

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
          throw new Error(
            `❌ Not enough stock for "${item.name}". Need: ${orderItem.quantity}, Have: ${item.quantity}`
          );
        }

        // ✅ Atomic quantity update
        const quantityChange =
          operation === "increase" ? orderItem.quantity : -orderItem.quantity;

        await Category.updateOne(
          { _id: categoryId, "items._id": itemId },
          { $inc: { "items.$.quantity": quantityChange } }
        );

        console.log(
          `✅ ${operation === "increase" ? "Added" : "Subtracted"} ${
            orderItem.quantity
          } → "${item.name}"`
        );
      } catch (error: any) {
        console.error(
          `❌ Error updating item ${index + 1} (${orderItem.itemName}):`,
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
    _id: new mongoose.Types.ObjectId(item.categoryId),
    categoryId: new mongoose.Types.ObjectId(item.originalCategoryId),
    categoryName: item.categoryName,
    itemName: item.itemName,
    image: item.image,
    points: item.points,
    price: item.price,
    measurement_unit: item.measurement_unit as 1 | 2,
    quantity: item.quantity,
  }));
}
