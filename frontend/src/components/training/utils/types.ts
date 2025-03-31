import { CollectionPermission } from '../../../types/collection';

// ReExport the Collection type from the main types
export type { Collection } from '../../../types/collection';
export { CollectionPermission } from '../../../types/collection';

// Extended Collection with additional properties used in our components
export interface CollectionExtended {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission: CollectionPermission | string[] | undefined;
  lastModified?: string;
  modificationHistory?: {
    timestamp: string;
    action: string;
    details: string;
  }[];
  documentCount?: number;
  isPrivate?: boolean;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  nameID?: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  collectionId: string;
  uploadedBy: string;
  timestamp: string;
  ids: string[];
}

export interface MongoFile {
  filename: string;
  uploadedBy?: string;
  timestamp?: string;
  ids?: string[];
}

export interface ModificationHistoryItem {
  timestamp: string;
  action: string;
  details: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
} 