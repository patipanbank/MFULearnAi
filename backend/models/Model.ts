import mongoose from 'mongoose';

export interface IModel {
  name: string;
  collections: string[]; // The collection names used for vector queries.
  createdBy: string;
  created: Date;
}

const modelSchema = new mongoose.Schema<IModel>({
  name: { type: String, required: true },
  collections: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  created: { type: Date, default: Date.now },
});

export const ModelModel = mongoose.model<IModel>('Model', modelSchema); 