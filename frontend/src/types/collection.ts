export type CollectionPermission = 'PUBLIC' | 'PRIVATE';

export interface Collection {
  id: string;
  name: string;
  permission: CollectionPermission;
  createdBy: string;
  createdAt?: string;
} 