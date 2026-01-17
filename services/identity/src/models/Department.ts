import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
    code: string;
    name: string;
    faculty?: string;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}

const DepartmentSchema: Schema = new Schema({
    code: { type: String, required: true, unique: true }, // e.g., 'IT', 'MAE', or slugified name
    name: { type: String, required: true },
    faculty: { type: String },
    metadata: { type: Object }
}, {
    timestamps: true
});

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
