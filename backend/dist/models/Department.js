"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Department = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const departmentSchema = new mongoose_1.Schema({
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
        max: 5
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
departmentSchema.index({ name: 1, isActive: 1 });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ level: 1, isActive: 1 });
departmentSchema.virtual('subdepartments', {
    ref: 'Department',
    localField: 'name',
    foreignField: 'parentDepartment'
});
departmentSchema.pre('save', function (next) {
    this.updated = new Date();
    next();
});
departmentSchema.statics.findOrCreate = async function (departmentName, displayName) {
    if (!departmentName || typeof departmentName !== 'string') {
        return null;
    }
    const cleanName = departmentName.toLowerCase().trim();
    if (!cleanName)
        return null;
    try {
        let department = await this.findOne({ name: cleanName });
        if (!department) {
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
    }
    catch (error) {
        console.error(`Failed to find/create department ${cleanName}:`, error);
        return null;
    }
};
departmentSchema.statics.incrementUserCount = async function (departmentName) {
    if (!departmentName)
        return;
    const cleanName = departmentName.toLowerCase().trim();
    await this.findOneAndUpdate({ name: cleanName }, { $inc: { userCount: 1 }, $set: { updated: new Date() } });
};
departmentSchema.statics.decrementUserCount = async function (departmentName) {
    if (!departmentName)
        return;
    const cleanName = departmentName.toLowerCase().trim();
    await this.findOneAndUpdate({ name: cleanName, userCount: { $gt: 0 } }, { $inc: { userCount: -1 }, $set: { updated: new Date() } });
};
departmentSchema.statics.recalculateUserCounts = async function () {
    try {
        const User = mongoose_1.default.model('User');
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
        const departments = await this.find({});
        for (const dept of departments) {
            const userCount = userCounts.find(uc => uc._id === dept.name);
            dept.userCount = userCount ? userCount.count : 0;
            await dept.save();
        }
        console.log(`📊 Recalculated user counts for ${departments.length} departments`);
        return true;
    }
    catch (error) {
        console.error('Failed to recalculate user counts:', error);
        return false;
    }
};
exports.Department = mongoose_1.default.model('Department', departmentSchema);
//# sourceMappingURL=Department.js.map