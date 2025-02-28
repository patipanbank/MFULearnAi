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
  role: { 
    type: String, 
    enum: ['Admin', 'Staffs', 'Students', 'SuperAdmin'],
    default: function(this: any) {
      // กำหนด role จาก group
      const groups = this.groups || [];
      if (groups.includes('Admin')) return 'Admin';
      if (groups.includes('SuperAdmin')) return 'SuperAdmin';
      // ถ้าเป็น Student group ID จาก SAML
      if (groups.includes('S-1-5-21-893890582-1041674030-1199480097-43779')) return 'Students';
      return 'Staffs'; // default เป็น Staffs ถ้าไม่ตรงเงื่อนไขอื่น
    }
  },
  groups: [String],
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now },
  monthlyQuota: {
    type: Number,
    default: function(this: any) {
      const groups = this.groups || [];
      // ตรวจสอบ group จาก SAML
      if (groups.includes('Admin') || groups.includes('SuperAdmin')) {
        return 100; // Admin quota
      }
      if (groups.includes('S-1-5-21-893890582-1041674030-1199480097-43779')) {
        return 20; // Student quota
      }
      return 50; // Staff quota (default)
    }
  }
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