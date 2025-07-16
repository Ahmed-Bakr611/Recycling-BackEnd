import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  city: { type: String, required: true },
  area: String,
  street: String,
  building: String,
  floor: String,
  apartment: String,
  landmark: String,
  isDefault: { type: Boolean, default: false },
});
const UserSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addresses: [AddressSchema],

  phoneNumber: { type: String, required: true },
  userName: { type: String, required: true },
}, { _id: false });


const ItemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  totalPoints: Number,
  TotalMoney: Number

});

const OrderSchema = new mongoose.Schema({
  user: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    phoneNumber: String,
    userName: String,
  },
  address: AddressSchema, 
  items: [ItemSchema],
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});


export default mongoose.model('Order', OrderSchema);
