export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

export enum CollectionType {
  DEFAULT = 'DEFAULT',
  DEPARTMENT = 'DEPARTMENT'
}

export interface Collection {
  id: string;
  name: string;
  createdBy: string;
  created: string;
  permission: CollectionPermission | string[] | undefined;
  type?: CollectionType;
  lastModified?: string;
  modificationHistory?: {
    timestamp: string;
    action: string;
    details: string;
  }[];
} 