// User role type
export type UserRole = 'student' | 'staff' | 'admin' | 'superadmin';

export interface User {
  userId?: string;
  nameID: string;
  username: string; // derived from User.Userrname or email
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role: UserRole;
  groups: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  images?: Array<{
    data: string; // base64
    mediaType: string;
  }>;
  files?: Array<{
    name: string;
    data: string;
    mediaType: string;
    size: number;
    content?: string;
  }>;
  isImageGeneration?: boolean;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}
