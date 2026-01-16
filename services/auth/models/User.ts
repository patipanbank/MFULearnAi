import mongoose, { Schema, Document } from 'mongoose';
import { User as IUser, UserRole } from '../../../shared/types';

export interface UserDocument extends Document, Omit<IUser, 'userId'> {
    createdAt: Date;
    updatedAt: Date;
    comparePassword?(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    nameID: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String }, // For admin accounts
    firstName: { type: String },
    lastName: { type: String },
    department: { type: String },
    role: {
        type: String,
        enum: ['student', 'staff', 'admin', 'superadmin'] as UserRole[],
        default: 'student'
    },
    permissions: [{ type: String }],
    groups: [{ type: String }],
    googleId: { type: String },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Password comparison for admin login
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<UserDocument>('User', UserSchema);
