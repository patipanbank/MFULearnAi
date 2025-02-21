import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends mongoose.Document {
  nameID?: string;
  username?: string;
  password?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  role?: string;
  created?: Date;
  updated?: Date;
  isAdmin?: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const Role = ['Students', 'Staffs', 'Admin'];

const userSchema = new mongoose.Schema({
  nameID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: false,
    unique: true,
    index: true
  },
  password: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: false,
    unique: true,
    index: true
  },
  firstName: String,
  lastName: String,
  groups: {
    type: [String],
    enum: Role,
    default: ['Students']
  },
  role: { 
    type: String, 
    enum: Role, 
    required: true 
  }, 
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  },
  // password: { type: String },
  isAdmin: { type: Boolean, default: false },
});

userSchema.methods.hasRole = function(roles: string[]) {
  return this.groups.some((group: string) => roles.includes(group));
};

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

export default mongoose.model('User', userSchema);