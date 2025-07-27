import Item from "../models/item"; // adjust the path as needed
import { IItem } from "../models/pickupOrder";

type Operation = "increase" | "decrease";

export const updateItemQuantities = async (
  items: IItem[],
  operation: Operation
) => {
  for (const item of items) {
    const dbItem = await Item.findById(item._id);
    if (!dbItem) {
      throw new Error(`Item with ID ${item._id} not found`);
    }

    if (operation === "decrease") {
      if (dbItem.quantity < item.quantity) {
        throw new Error(`Not enough quantity for item: ${dbItem.name}`);
      }
      dbItem.quantity -= item.quantity;
    } else if (operation === "increase") {
      dbItem.quantity += item.quantity;
    } else {
      throw new Error(
        `Invalid operation "${operation}". Expected "increase" or "decrease".`
      );
    }

    await dbItem.save();
  }
};
