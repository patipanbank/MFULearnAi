export * from './api.types';
export * from './domain.types';
export type { ApiResponse, ApiError, PaginatedResponse, RequestContext, QueryOptions, SortOptions, FilterOptions, FileUpload, } from './api.types';
export type { User, UserRole, Message, MessageType, Chat, Agent, AgentType, Collection, CollectionType, Document, DocumentStatus, Embedding, Department, SystemPrompt, ChatStats, UserStats, Tool, Job, JobStatus, } from './domain.types';
export type ID = string;
export type Timestamp = Date;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export interface MongoDocument {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface PaginationOptions {
    page: number;
    limit: number;
    sort?: Record<string, 1 | -1>;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface BusinessError {
    code: string;
    message: string;
    details?: any;
}
export interface DomainEvent {
    id: string;
    type: string;
    aggregateId: string;
    data: any;
    timestamp: Date;
    version: number;
}
