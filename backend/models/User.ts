import mongoose from 'mongoose';

export type UserRole = 'ADMIN' | 'STAFF' | 'USER';

const userSchema = new mongoose.Schema({
  nameID: String,
  username: { type: String, required: true, unique: true },
  email: String,
  firstName: String,
  lastName: String,
  role: { 
    type: String, 
    enum: ['ADMIN', 'STAFF', 'USER'],
    default: 'USER'
  },
  groups: [String],
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);