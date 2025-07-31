export interface MongoDBId {
  $oid: string;
}

export interface MongoDBDate {
  $date: string;
}

export interface User {
  _id: { $oid: string };
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'superadmin';
  department_id?: { $oid: string };
  student_id?: string;
  username?: string;
  is_active: boolean;
  usage: {
    total_tokens: number;
    total_requests: number;
  };
}

export interface Collection {
  _id?: string;
  id?: string; // For backward compatibility
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
  department?: string;
  modelId?: string;
}

// Legacy Collection interface for backward compatibility
export interface LegacyCollection {
  id: string;
  name: string;
  permission: string;
  createdBy: string;
  createdAt?: string;
} 