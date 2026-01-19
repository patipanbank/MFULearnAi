import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// Embedded types because we are in a microservice (shared types might not be accessible during build if not careful, duplicating for safety/autonomy)
export type UserRole = 'student' | 'staff' | 'admin' | 'superadmin';

export interface UserDocument extends Document {
    nameID?: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    role: UserRole;
    groups: string[];
    googleId?: string;
    password?: string;
    lastLogin?: Date;
    loginCount?: number;
    isActive?: boolean;
    permissions?: string[];
    createdAt: Date;
    updatedAt: Date;
    comparePassword?(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    nameID: { type: String, required: false, unique: true, sparse: true },
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
