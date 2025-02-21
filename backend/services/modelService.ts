import { ModelModel, IModel } from '../models/Model';

export class ModelService {
  async getModelById(modelId: string): Promise<IModel | null> {
    return await ModelModel.findById(modelId);
  }
  
  async createDefaultModel(userId: string): Promise<IModel> {
    // For personal default models.
    const defaultModel = new ModelModel({
      name: "Default Model",
      collections: [],
      createdBy: userId,
      modelType: "personal"
    });
    return await defaultModel.save();
  }
  
  async createCustomModel(userId: string, name: string, collections: string[]): Promise<IModel> {
    // For personal custom models.
    const customModel = new ModelModel({
      name,
      collections,
      createdBy: userId,
      modelType: "personal"
    });
    return await customModel.save();
  }
  
  async createOfficialModel(userId: string, name: string, collections: string[]): Promise<IModel> {
    // Only staff should be allowed to call this method
    // Enforce roleGuard at the route level.
    const officialModel = new ModelModel({
      name,
      collections,
      createdBy: userId,
      modelType: "official"
    });
    return await officialModel.save();
  }
  
  async getOfficialModels(): Promise<IModel[]> {
    // Retrieve only models that have been deployed as official.
    return await ModelModel.find({ modelType: "official" });
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
}

export const modelService = new ModelService(); 