export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

export interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission: CollectionPermission | string[] | undefined;
  description?: string;
  keywords?: string[];
  lastModified?: string;
  modificationHistory?: {
    timestamp: string;
    action: string;
    details: string;
  }[];
} 