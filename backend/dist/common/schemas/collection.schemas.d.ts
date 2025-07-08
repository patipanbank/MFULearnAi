import { z } from 'zod';
export declare const collectionNameSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const collectionDescriptionSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
export declare const collectionPermissionSchema: z.ZodEnum<["public", "private", "department"]>;
export declare const documentNameSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const documentContentSchema: z.ZodString;
export declare const documentTypeSchema: z.ZodEnum<["pdf", "txt", "docx", "md"]>;
export declare const createCollectionSchema: z.ZodObject<{
    name: z.ZodEffects<z.ZodString, string, string>;
    description: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    permission: z.ZodDefault<z.ZodEnum<["public", "private", "department"]>>;
    departmentId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    permission: "public" | "private" | "department";
    tags?: string[] | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
}, {
    name: string;
    tags?: string[] | undefined;
    description?: string | undefined;
    permission?: "public" | "private" | "department" | undefined;
    departmentId?: string | undefined;
}>;
export declare const updateCollectionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    description: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    permission: z.ZodOptional<z.ZodEnum<["public", "private", "department"]>>;
    departmentId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    permission?: "public" | "private" | "department" | undefined;
    departmentId?: string | undefined;
}, {
    name?: string | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    permission?: "public" | "private" | "department" | undefined;
    departmentId?: string | undefined;
}>;
export declare const collectionParamsSchema: z.ZodObject<{
    collectionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    collectionId: string;
}, {
    collectionId: string;
}>;
export declare const getCollectionsQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, number, string | undefined>;
    search: z.ZodOptional<z.ZodString>;
    permission: z.ZodOptional<z.ZodEnum<["public", "private", "department"]>>;
    departmentId: z.ZodOptional<z.ZodString>;
    tags: z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    search?: string | undefined;
    tags?: string[] | undefined;
    permission?: "public" | "private" | "department" | undefined;
    departmentId?: string | undefined;
}, {
    search?: string | undefined;
    tags?: string | undefined;
    limit?: string | undefined;
    page?: string | undefined;
    permission?: "public" | "private" | "department" | undefined;
    departmentId?: string | undefined;
}>;
export declare const uploadDocumentSchema: z.ZodObject<{
    name: z.ZodEffects<z.ZodString, string, string>;
    content: z.ZodString;
    type: z.ZodEnum<["pdf", "txt", "docx", "md"]>;
    metadata: z.ZodOptional<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        summary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    }, {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "pdf" | "txt" | "md" | "docx";
    content: string;
    metadata?: {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    } | undefined;
}, {
    name: string;
    type: "pdf" | "txt" | "md" | "docx";
    content: string;
    metadata?: {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    } | undefined;
}>;
export declare const updateDocumentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    content: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        author: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        summary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    }, {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    metadata?: {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    } | undefined;
    content?: string | undefined;
}, {
    name?: string | undefined;
    metadata?: {
        author?: string | undefined;
        keywords?: string[] | undefined;
        summary?: string | undefined;
    } | undefined;
    content?: string | undefined;
}>;
export declare const documentParamsSchema: z.ZodObject<{
    collectionId: z.ZodString;
    documentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentId: string;
    collectionId: string;
}, {
    documentId: string;
    collectionId: string;
}>;
export declare const getDocumentsQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, number, string | undefined>;
    limit: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, number, string | undefined>;
    search: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["pdf", "txt", "docx", "md"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    search?: string | undefined;
    type?: "pdf" | "txt" | "md" | "docx" | undefined;
}, {
    search?: string | undefined;
    limit?: string | undefined;
    page?: string | undefined;
    type?: "pdf" | "txt" | "md" | "docx" | undefined;
}>;
export declare const searchCollectionSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    threshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    query: string;
    threshold: number;
}, {
    query: string;
    limit?: number | undefined;
    threshold?: number | undefined;
}>;
export declare const bulkUploadDocumentsSchema: z.ZodObject<{
    documents: z.ZodArray<z.ZodObject<{
        name: z.ZodEffects<z.ZodString, string, string>;
        content: z.ZodString;
        type: z.ZodEnum<["pdf", "txt", "docx", "md"]>;
        metadata: z.ZodOptional<z.ZodObject<{
            author: z.ZodOptional<z.ZodString>;
            keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            summary: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            author?: string | undefined;
            keywords?: string[] | undefined;
            summary?: string | undefined;
        }, {
            author?: string | undefined;
            keywords?: string[] | undefined;
            summary?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "pdf" | "txt" | "md" | "docx";
        content: string;
        metadata?: {
            author?: string | undefined;
            keywords?: string[] | undefined;
            summary?: string | undefined;
        } | undefined;
    }, {
        name: string;
        type: "pdf" | "txt" | "md" | "docx";
        content: string;
        metadata?: {
            author?: string | undefined;
            keywords?: string[] | undefined;
            summary?: string | undefined;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    documents: {
        name: string;
        type: "pdf" | "txt" | "md" | "docx";
        content: string;
        metadata?: {
            author?: string | undefined;
            keywords?: string[] | undefined;
            summary?: string | undefined;
        } | undefined;
    }[];
}, {
    documents: {
        name: string;
        type: "pdf" | "txt" | "md" | "docx";
        content: string;
        metadata?: {
            author?: string | undefined;
            keywords?: string[] | undefined;
            summary?: string | undefined;
        } | undefined;
    }[];
}>;
export declare const bulkDeleteDocumentsSchema: z.ZodObject<{
    documentIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    documentIds: string[];
}, {
    documentIds: string[];
}>;
export type CreateCollectionDto = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionDto = z.infer<typeof updateCollectionSchema>;
export type CollectionParamsDto = z.infer<typeof collectionParamsSchema>;
export type GetCollectionsQuery = z.infer<typeof getCollectionsQuerySchema>;
export type UploadDocumentDto = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;
export type DocumentParamsDto = z.infer<typeof documentParamsSchema>;
export type GetDocumentsQuery = z.infer<typeof getDocumentsQuerySchema>;
export type SearchCollectionDto = z.infer<typeof searchCollectionSchema>;
export type BulkUploadDocumentsDto = z.infer<typeof bulkUploadDocumentsSchema>;
export type BulkDeleteDocumentsDto = z.infer<typeof bulkDeleteDocumentsSchema>;
