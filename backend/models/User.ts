import mongoose from 'mongoose';

export type UserRole = 'ADMIN' | 'Staffs' | 'Students';

const userSchema = new mongoose.Schema({
  nameID: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: String,
  firstName: String,
  lastName: String,
  role: { 
    type: String, 
    enum: ['ADMIN', 'Staffs', 'Students'],
    default: 'Students'
  },
  groups: [String],
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);