export type ModelType = 'official' | 'personal' | 'department';

export interface Model {
  _id: string;
  name: string;
  collections: string[];
  createdBy: string;
  modelType: ModelType;
  department?: string;
  createdAt: string;
  updatedAt: string;
} 