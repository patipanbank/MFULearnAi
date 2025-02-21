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

  // Add a collection to a model if it isn't already there.
  async addCollectionToModel(modelId: string, collectionName: string): Promise<IModel | null> {
    const model = await ModelModel.findById(modelId);
    if (model) {
      if (!model.collections.includes(collectionName)) {
        model.collections.push(collectionName);
        await model.save();
      }
    }
    return model;
  }

  async deleteModel(modelId: string): Promise<IModel | null> {
    return await ModelModel.findByIdAndDelete(modelId);
  }

  async getModelsByUser(userId: string): Promise<IModel[]> {
    return await ModelModel.find({ createdBy: userId });
  }
}

export const modelService = new ModelService(); 