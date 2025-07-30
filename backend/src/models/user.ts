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
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', userSchema); 