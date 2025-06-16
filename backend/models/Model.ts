import { Schema, model, Document } from 'mongoose';

export interface ModelDocument extends Document {
  name: string;
  description: string;
  collections: { name: string; description: string }[];
  createdBy: string;
  modelType: 'official' | 'personal' | 'department';
  department?: Schema.Types.ObjectId;
  isAgent: boolean;
  prompt: string;
  displayRetrievedChunks: boolean;
  createdAt: Date;
  updatedAt: Date;
  is_public: boolean;
  user: Schema.Types.ObjectId;
  system_prompt: string | null;
  is_active: boolean;
}

const modelSchema = new Schema<ModelDocument>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  collections: [{
    name: { type: String, required: true },
    description: { type: String, required: true }
  }],
  createdBy: { type: String, required: true },
  modelType: { type: String, enum: ['official', 'personal', 'department'], required: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  isAgent: { type: Boolean, default: false },
  prompt: { type: String, default: '' },
  displayRetrievedChunks: { type: Boolean, default: true },
  is_public: { type: Boolean, default: false },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  system_prompt: { type: String, default: null },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const ModelModel = model<ModelDocument>('Model', modelSchema);