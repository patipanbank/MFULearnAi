import { Schema, model, Document } from 'mongoose';
import { Request } from 'express';

export interface IModel extends Document {
  name: string;
  type: 'personal' | 'official';
  collections: string[];
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ModelSchema = new Schema<IModel>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['personal', 'official'], required: true },
    collections: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const ModelModel = model<IModel>('Model', ModelSchema);

export interface RequestWithUser extends Request {
  user: {
    _id: string;
    role: string;
    groups: string[];
  };
  samlLogoutRequest?: any;
} 