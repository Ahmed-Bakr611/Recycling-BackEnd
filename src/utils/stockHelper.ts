import Category from "../models/category";
import { IItem } from "../models/pickupOrder";
import { Types } from "mongoose";

type Operation = "increase" | "decrease";

export const updateItemQuantities = async (
  items: IItem[], // must include categoryId and name
  operation: Operation
) => {
  for (const item of items) {
    const categoryId = new Types.ObjectId(item.categoryId);

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error(`Category with ID ${item.categoryId} not found`);
    }

    // 🔍 Find the embedded item by name
    const targetItem = category.items.find(
      (i: any) => i.name.toLowerCase() === item.itemName.toLowerCase()
    );

    if (!targetItem) {
      throw new Error(
        `Item with name "${item.itemName}" not found in category ${item.categoryId}`
      );
    }

    if (operation === "decrease") {
      if (targetItem.quantity < item.quantity) {
        throw new Error(`Not enough quantity for item: ${targetItem.name}`);
      }
      targetItem.quantity -= item.quantity;
    } else if (operation === "increase") {
      targetItem.quantity += item.quantity;
    } else {
      throw new Error(
        `Invalid operation "${operation}". Use "increase" or "decrease".`
      );
    }

    await category.save();
  }
};
