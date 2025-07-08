import { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface UserDocument extends Document {
  username: string;
  password: string;
  roles: string[];
  department?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<UserDocument>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: [{ type: String, required: true }],
  department: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String },
});

UserSchema.pre('save', async function (next) {
  const user = this as UserDocument;
  if (!user.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (cand: string) {
  return bcrypt.compare(cand, this.password);
};

export { UserSchema }; 