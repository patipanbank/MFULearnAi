import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  displayName: string;
  description?: string;
  userCount: number;
  isActive: boolean;
  parentDepartment?: string;
  level: number; // 0 = root, 1 = sub-department, etc.
  createdBy?: string;
  created: Date;
  updated: Date;
}

const departmentSchema = new Schema<IDepartment>({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  userCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  parentDepartment: {
    type: String,
    ref: 'Department'
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 5 // Limit hierarchy depth
  },
  createdBy: {
    type: String,
    ref: 'User'
  },
  created: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
departmentSchema.index({ name: 1, isActive: 1 });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ level: 1, isActive: 1 });

// Virtual for subdepartments
departmentSchema.virtual('subdepartments', {
  ref: 'Department',
  localField: 'name',
  foreignField: 'parentDepartment'
});

// Update timestamp on save
departmentSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Static method to find or create department
departmentSchema.statics.findOrCreate = async function(departmentName: string, displayName?: string) {
  if (!departmentName || typeof departmentName !== 'string') {
    return null;
  }

  const cleanName = departmentName.toLowerCase().trim();
  if (!cleanName) return null;

  try {
    // Try to find existing department
    let department = await this.findOne({ name: cleanName });

    if (!department) {
      // Create new department
      department = new this({
        name: cleanName,
        displayName: displayName || departmentName.trim(),
        userCount: 0,
        level: 0,
        isActive: true
      });
      await department.save();
      console.log(`📁 Created new department: ${cleanName} (${department.displayName})`);
    }

    return department;
  } catch (error) {
    console.error(`Failed to find/create department ${cleanName}:`, error);
    return null;
  }
};

// Static method to increment user count
departmentSchema.statics.incrementUserCount = async function(departmentName: string) {
  if (!departmentName) return;

  const cleanName = departmentName.toLowerCase().trim();
  await this.findOneAndUpdate(
    { name: cleanName },
    { $inc: { userCount: 1 }, $set: { updated: new Date() } }
  );
};

// Static method to decrement user count
departmentSchema.statics.decrementUserCount = async function(departmentName: string) {
  if (!departmentName) return;

  const cleanName = departmentName.toLowerCase().trim();
  await this.findOneAndUpdate(
    { name: cleanName, userCount: { $gt: 0 } },
    { $inc: { userCount: -1 }, $set: { updated: new Date() } }
  );
};

// Static method to recalculate user counts
departmentSchema.statics.recalculateUserCounts = async function() {
  try {
    const User = mongoose.model('User');

    // Get user counts by department
    const userCounts = await User.aggregate([
      {
        $match: {
          department: { $exists: true, $nin: [null, ''] }
        }
      },
      {
        $group: {
          _id: { $toLower: '$department' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Update all departments
    const departments = await this.find({});

    for (const dept of departments) {
      const userCount = userCounts.find(uc => uc._id === dept.name);
      dept.userCount = userCount ? userCount.count : 0;
      await dept.save();
    }

    console.log(`📊 Recalculated user counts for ${departments.length} departments`);
    return true;
  } catch (error) {
    console.error('Failed to recalculate user counts:', error);
    return false;
  }
};

// Define interface for static methods
interface IDepartmentModel extends mongoose.Model<IDepartment> {
  findOrCreate(departmentName: string, displayName?: string): Promise<IDepartment | null>;
  incrementUserCount(departmentName: string): Promise<void>;
  decrementUserCount(departmentName: string): Promise<void>;
  recalculateUserCounts(): Promise<boolean>;
}

export const Department = mongoose.model<IDepartment, IDepartmentModel>('Department', departmentSchema);