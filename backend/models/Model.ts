import mongoose, { Schema, Document } from 'mongoose';

/* Define the type for model types */
export type ModelType = "official" | "personal";

/* Extended IModel interface to include a modelType field */
export interface IModel extends Document {
  _id: string; // Use string for _id
  name: string;
  collections: string[]; // The collection names used for vector queries.
  createdBy: string;
  created: Date;
  modelType: ModelType;      // "official" for staff-deployed models, "personal" for user specific models
}

const modelSchema = new Schema<IModel>({
  // Set _id to type String; a default value is generated as a string version of an ObjectId.
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  collections: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  created: { type: Date, default: Date.now },
  modelType: { type: String, enum: ["official", "personal"], default: "personal" }
});

export const ModelModel = mongoose.model<IModel>('Model', modelSchema); 