export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  STAFF_ONLY = 'STAFF_ONLY',
  PRIVATE = 'PRIVATE'
}

export interface Collection {
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
} 