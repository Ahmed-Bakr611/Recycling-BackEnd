// types/order.types.ts
import { Document, Types } from "mongoose";

export interface IAddress {
  city: string;
  area?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface IUserEmbedded {
  userId: Types.ObjectId;
  phoneNumber?: string;
  userName: string;
  email?: string;
}

export interface IItem {
  categoryId: Types.ObjectId;
  image: string;
  itemName: string;
  measurement_unit: 1 | 2;
  points: number;
  price: number;
  quantity: number;
  categoryName?: string;
}

export interface IStatusHistory {
  status: string;
  timestamp: Date;
  updatedBy: Types.ObjectId;
  updatedByName?: string;
  note?: string;
}

export interface ICourierInfo {
  name?: string;
  phone?: string;
  email?: string;
}

export interface IOrder extends Document {
  user: IUserEmbedded;
  address: IAddress;
  items: IItem[];
  status: string;
  assignedCourier?: Types.ObjectId | null;
  assignedAt?: Date | null;
  courierInfo?: ICourierInfo;
  statusHistory: IStatusHistory[];
  totalAmount: number;
  totalPoints: number;
  paymentMethod: "Cash on Delivery" | "Credit Card" | "Points" | "Wallet";
  paymentStatus: "Pending" | "Paid" | "Failed" | "Refunded";
  deliveryDate?: Date;
  deliveryTimeSlot?: string;
  deliveryNotes?: string;
  trackingNumber?: string;
  isUrgent: boolean;
  isCancelled: boolean;
  cancelReason?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  orderNumber: string;
  formattedCreatedAt: string;

  addStatusHistory: (
    status: string,
    updatedBy: Types.ObjectId,
    updatedByName: string,
    note?: string
  ) => Promise<IOrder>;

  assignCourier: (
    courierId: Types.ObjectId,
    courierInfo: ICourierInfo,
    assignedBy: Types.ObjectId,
    assignedByName: string
  ) => Promise<IOrder>;

  unassignCourier: (
    unassignedBy: Types.ObjectId,
    unassignedByName: string,
    reason?: string
  ) => Promise<IOrder>;
}
