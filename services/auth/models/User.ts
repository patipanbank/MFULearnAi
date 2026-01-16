import mongoose, { Schema, Document } from 'mongoose';
import { User as IUser } from '../../../shared/types';

export interface UserDocument extends Document, Omit<IUser, 'userId'> {
    createdAt: Date;
    updatedAt: Date;
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
    googleId: { type: String }
}, {
    timestamps: true
});

export default mongoose.model<UserDocument>('User', UserSchema);
