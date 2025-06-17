import { Schema, model, Document } from 'mongoose';

export interface ModelDocument extends Document {
  name: string;
  description?: string;
  collections: { name: string; description?: string }[];
  createdBy: string;
  modelType: 'official' | 'personal' | 'department';
  department?: string;
  isAgent: boolean;
  prompt: string;
  displayRetrievedChunks: boolean;
  createdAt: Date;
  updatedAt: Date;
  is_public: boolean;
  user?: Schema.Types.ObjectId;
  system_prompt: string | null;
  is_active: boolean;
}

const modelSchema = new Schema<ModelDocument>({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  collections: [{
    name: { type: String, required: true },
    description: { type: String, default: '' }
  }],
  createdBy: { type: String, required: true },
  modelType: { type: String, enum: ['official', 'personal', 'department'], required: true },
  department: { type: String },
  isAgent: { type: Boolean, default: false },
  prompt: { type: String, default: '' },
  displayRetrievedChunks: { type: Boolean, default: true },
  is_public: { type: Boolean, default: false },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  system_prompt: { type: String, default: null },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Add validation for collection references
modelSchema.pre('save', async function(next) {
  if (this.isModified('collections')) {
    const { CollectionModel } = await import('./Collection.js');
    for (const collection of this.collections) {
      const exists = await CollectionModel.findOne({ name: collection.name });
      if (!exists) {
        throw new Error(`Collection '${collection.name}' does not exist`);
      }
    }
  }
  next();
});

// Add index for better query performance
modelSchema.index({ createdBy: 1, modelType: 1 });
modelSchema.index({ 'collections.name': 1 });

export const ModelModel = model<ModelDocument>('Model', modelSchema);