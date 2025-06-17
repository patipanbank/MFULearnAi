export interface Model {
  id: string;
  name: string;
  description?: string;
  collections: Array<{ name: string; description?: string }> | string[]; // Support both formats for backward compatibility
  modelType: 'official' | 'personal' | 'department';
  department?: string;
  isAgent?: boolean;
  prompt?: string;
  displayRetrievedChunks?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission: CollectionPermission | string[] | undefined;
}

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

export interface User {
  username: string;
  role: string;
  groups?: string[];
  nameID: string;
  firstName: string;
  department?: string;
} 