import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  city: String,
  area: String,
  street: String,
  buildingNumber: String,
  floorNumber: String,
  apartmentNumber: String,
  landmark: String
});

const ItemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  totalPoints: Number,
  TotalMoney: Number

});

const OrderSchema = new mongoose.Schema({
  userId: String,
  address: AddressSchema,
  items: [ItemSchema],
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Order', OrderSchema);
