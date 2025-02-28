import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

export type UserRole = 'Admin' | 'Staffs' | 'Students' | 'SuperAdmin';

interface IUser extends mongoose.Document {
  nameID: string;
  username: string;
  password?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  groups: string[];
  created: Date;
  updated: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  monthlyQuota: number;
}

const userSchema = new mongoose.Schema({
  nameID: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String },
  email: String,
  firstName: String,
  lastName: String,
  groups: { 
    type: [String],
    default: [] 
  },
  role: { 
    type: String, 
    enum: ['Admin', 'Staffs', 'Students', 'SuperAdmin'],
    default: 'Students' // ค่าเริ่มต้นเป็น Staffs
  },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now },
  monthlyQuota: {
    type: Number,
    default: 50 // ค่าเริ่มต้นเป็น 50
  }
});

// Pre-save middleware เพื่อกำหนด role และ monthlyQuota จาก groups
userSchema.pre('save', function(next) {
  const groups = this.groups || [];
  
  // กำหนด role จาก groups
  if (groups.includes('Admin')) {
    this.role = 'Admin';
    this.monthlyQuota = 100;
  } else if (groups.includes('SuperAdmin')) {
    this.role = 'SuperAdmin';
    this.monthlyQuota = 100;
  } else if (groups.includes('S-1-5-21-893890582-1041674030-1199480097-43779')) {
    this.role = 'Students';
    this.monthlyQuota = 20;
  } else {
    this.role = 'Staffs';
    this.monthlyQuota = 50;
  }

  next();
});

// Add comparePassword method to the schema
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

export default mongoose.model<IUser>('User', userSchema);