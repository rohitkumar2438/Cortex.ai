import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  email: { type: String, required: true },
  name: String,
  picture: String,
  credits: { type: Number, default: 100 }, // Starting credits
}, { timestamps: true });

export default mongoose.model('User', userSchema);
