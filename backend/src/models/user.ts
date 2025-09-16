import mongoose, { Document, Schema } from 'mongoose';

export enum UserRole {
  ADMIN = 'Admin',
  STAFFS = 'Staffs',
  STUDENTS = 'Students',
  SUPER_ADMIN = 'SuperAdmin'
}

export interface IUser extends Document {
  nameID: string;
  username: string;
  password?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role: UserRole;
  groups: string[];
  tokenQuota?: number;
  dailyTokenLimit?: number;
  created: Date;
  updated: Date;
}

const userSchema = new Schema<IUser>({
  nameID: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String },
  email: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  department: { type: String },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    default: UserRole.STUDENTS 
  },
  groups: { type: [String], default: [] },
  tokenQuota: { type: Number, default: 10000 },
  dailyTokenLimit: { type: Number, default: 10000 },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// Performance indexes for common queries
userSchema.index({ username: 1 }); // Already unique, but explicit for query performance
userSchema.index({ email: 1 }); // Email lookups
userSchema.index({ nameID: 1 }); // SAML/SSO lookups
userSchema.index({ role: 1 }); // Admin/role-based queries
userSchema.index({ department: 1, role: 1 }); // Department + role filtering
userSchema.index({ created: -1 }); // Recent user queries
userSchema.index({ updated: -1 }); // Recently updated users

// Update the updated field before saving
userSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);