import Category from "../models/category";
import { IItem } from "../models/pickupOrder";
import { Types } from "mongoose";

type Operation = "increase" | "decrease";

export const updateItemQuantities = async (
  items: IItem[], // must include categoryId and name
  operation: Operation
) => {
  console.log(
    "BAKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk"
  );
  console.log(
    "----------------------------------------------------------------------------"
  );
  console.log("inside update Quantity Now");
  console.log(
    "----------------------------------------------------------------------------"
  );
  console.log("icooming items ::");
  console.log(
    "----------------------------------------------------------------------------"
  );
  console.log(items);
  console.log(
    "----------------------------------------------------------------------------"
  );
  const categories = await Category.find();

  for (const category of categories) {
    let modified = false;

    for (const { categoryId, quantity } of items) {
      const stokItem = category.items.id(categoryId); // ← Find item by _id in embedded array
      if (stokItem) {
        if (operation === "decrease") {
          if (stokItem.quantity < quantity) {
            throw new Error(`Not enough quantity for item: ${stokItem.name}`);
          }
          stokItem.quantity -= quantity;
        } else if (operation === "increase") {
          stokItem.quantity += quantity;
        } else {
          throw new Error(
            `Invalid operation "${operation}". Use "increase" or "decrease".`
          );
        }
        modified = true;
      }
    }

    if (modified) {
      await category.save();
      console.log(`Updated category: ${category.name}`);
    }
  }
};
