import mongoose, { Schema, Document } from 'mongoose';

export interface IModel extends Document {
  _id: string; // Use string for _id
  name: string;
  collections: string[]; // The collection names used for vector queries.
  createdBy: string;
  created: Date;
}

const modelSchema = new Schema<IModel>({
  // Set _id to type String; a default value is generated as a string version of an ObjectId.
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  collections: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  created: { type: Date, default: Date.now },
});

export const ModelModel = mongoose.model<IModel>('Model', modelSchema); 