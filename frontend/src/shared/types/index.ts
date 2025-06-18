export interface MongoDBId {
  $oid: string;
}

export interface MongoDBDate {
  $date: string;
}

export interface User {
  _id: { $oid: string };
  email: string;
  first_name: string;
  last_name: string;
  role: 'user' | 'admin' | 'superadmin';
  department_id?: { $oid: string };
  is_active: boolean;
  usage: {
    total_tokens: number;
    total_requests: number;
  };
} 