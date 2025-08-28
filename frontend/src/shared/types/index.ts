// Re-export all types from specialized modules
export * from './agent';
export * from './knowledge';
export * from './chat';

// Legacy MongoDB types (keeping for compatibility)
export interface MongoDBId {
  $oid: string;
}

export interface MongoDBDate {
  $date: string;
}

// Core system types
export type UserRole = 'user' | 'admin' | 'superadmin';

export interface User {
  _id?: { $oid: string };
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department_id?: { $oid: string };
  department?: string;
  student_id?: string;
  username?: string;
  is_active?: boolean;
  avatar?: string;
  usage?: {
    total_tokens: number;
    total_requests: number;
  };
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface Modal {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
} 