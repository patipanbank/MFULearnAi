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

// --- Canonical IR Types for File Context ---

export interface CanonicalIR {
  file_type: 'document' | 'code' | 'image' | 'sheet';
  blocks: IRBlock[];
  metadata: {
    total_tokens?: number;
    warnings?: Warning[];
    detected_language?: string;
    layout?: 'single-column' | 'multi-column' | 'unknown';
  };
}

export interface IRBlock {
  type: 'text' | 'code' | 'table' | 'image_desc';
  content: string; // Text representation for prompt
  table_data?: { headers: string[]; rows: string[][] }; // Structured data for reuse/debugging
  metadata: {
    page?: number;
    sheet?: string;
    row_range?: string;
    language?: string;
    title?: string;
    confidence?: number; // 0-1. >0.85 safe.
    source?: 'text_layer' | 'ocr' | 'garbage_text_fallback';
  };
}

export interface Warning {
  code: 'SCANNED_PDF' | 'LOW_OCR_CONFIDENCE' | 'PARTIAL_PARSE' | 'GARBAGE_TEXT_LAYER';
  message: string;
}
