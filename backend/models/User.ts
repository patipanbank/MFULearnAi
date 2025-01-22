import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nameID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
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
    enum: ['Students', 'Staffs'], 
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

export default mongoose.models.User || mongoose.model('User', userSchema);