export interface MongoDBId {
  $oid: string;
}

export interface MongoDBDate {
  $date: string;
}

export interface User {
  _id: { $oid: string };
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
  created: Date | MongoDBDate;
  updated: Date | MongoDBDate;
  usage?: {
    total_tokens: number;
    total_requests: number;
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