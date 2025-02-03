export enum CollectionPermission {
  PUBLIC = 'public',
  STAFF_ONLY = 'staff_only',
  PRIVATE = 'private'
}

export interface Collection {
  name: string;
  permission: CollectionPermission;
  createdBy: string;
  created: Date;
} 