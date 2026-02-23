declare module 'pdf-parse';

/**
 * Shared user context for Knowledge Base operations.
 * Used by both KnowledgeController and KnowledgeService.
 */
export interface UserContext {
    userId: string;
    role: string;
    department: string;
}
