import mongoose from 'mongoose';

export interface IUser  {
  nameID?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  role?: string;
  created?: Date;
  updated?: Date;
}
const Role = ['Students', 'Staffs'];

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
    default: ['Students'],
    index: true
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
  }
});

userSchema.methods.hasRole = function(roles: string[]) {
  return this.groups.some((group: string) => roles.includes(group));
};

export default mongoose.model('User', userSchema);