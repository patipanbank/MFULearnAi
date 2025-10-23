export interface MongoDBId {
  $oid: string;
}

export interface MongoDBDate {
  $date: string;
}

/**
 * User interface matching backend response format
 * Backend sends _id as { $oid: string } format
 */
export interface User {
  _id: { $oid: string } | string;
  id?: string;
  nameID: string;
  username: string;
  password?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role: 'Admin' | 'Staffs' | 'Students' | 'SuperAdmin';
  groups: string[];
  tokenQuota?: number;
  dailyTokenLimit?: number;
  department_id?: { $oid: string };
  student_id?: string;
  is_active?: boolean;
  created: Date | MongoDBDate | string;
  updated: Date | MongoDBDate | string;
  lastLogin?: Date | MongoDBDate | string;
  usage?: {
    total_tokens: number;
    total_requests: number;
  };
}

/**
 * Helper function to normalize User data from backend
 */
export function normalizeUser(user: any): User {
  return {
    ...user,
    id: typeof user._id === 'object' && user._id.$oid ? user._id.$oid : user._id || user.id,
    created: user.created?.$date || user.created,
    updated: user.updated?.$date || user.updated,
    lastLogin: user.lastLogin?.$date || user.lastLogin,
  };
}

export interface Collection {
  _id: string;
  id: string; // Virtual field from backend
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
  department?: string;
  modelId?: string;
} 