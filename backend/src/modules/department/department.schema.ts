import { Schema, Document } from 'mongoose';

export interface DepartmentDocument extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DepartmentSchema = new Schema<DepartmentDocument>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
}, { timestamps: true });

DepartmentSchema.pre<DepartmentDocument>('save', function (this: DepartmentDocument, next: (err?: any) => void) {
  this.name = this.name.toLowerCase().trim();
  next();
}); 