import { ModelModel, IModel } from '../models/Model';

export class ModelService {
  async getModelById(modelId: string): Promise<IModel | null> {
    return await ModelModel.findById(modelId);
  }
  
  async createDefaultModel(userId: string): Promise<IModel> {
    // Each user gets a default model with no extra collections.
    const defaultModel = new ModelModel({
      name: "Default Model",
      collections: [],
      createdBy: userId,
    });
    return await defaultModel.save();
  }
  
  async createCustomModel(userId: string, name: string, collections: string[]): Promise<IModel> {
    const customModel = new ModelModel({
      name,
      collections,
      createdBy: userId,
    });
    return await customModel.save();
  }
  
  async updateModelCollections(modelId: string, collections: string[]): Promise<IModel | null> {
    return await ModelModel.findByIdAndUpdate(modelId, { collections }, { new: true });
  }
}

export const modelService = new ModelService(); 