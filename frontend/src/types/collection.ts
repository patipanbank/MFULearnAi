export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  STAFF_ONLY = 'STAFF_ONLY',
  PRIVATE = 'PRIVATE'
}

export interface Collection {
  id: string;
  name: string;
  permission: CollectionPermission | string;
  createdBy: string;
  created: string;
} 