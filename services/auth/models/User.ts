import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { User as IUser, UserRole } from '../../../shared/types';

export interface UserDocument extends Document, Omit<IUser, 'userId'> {
    password?: string;
    googleId?: string;
    lastLogin?: Date;
    loginCount?: number;
    isActive?: boolean;
    permissions?: string[];
    createdAt: Date;
    updatedAt: Date;
    comparePassword?(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    nameID: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    department: { type: String },
    role: {
        type: String,
        enum: ['student', 'staff', 'admin', 'superadmin'],
        default: 'student'
    },
    groups: [{ type: String }],
    googleId: { type: String },
    password: { type: String },
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    permissions: [{ type: String }]
}, {
    timestamps: true
});

// Password comparison method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<UserDocument>('User', UserSchema);
