"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteDocumentsSchema = exports.bulkUploadDocumentsSchema = exports.searchCollectionSchema = exports.getDocumentsQuerySchema = exports.documentParamsSchema = exports.updateDocumentSchema = exports.uploadDocumentSchema = exports.getCollectionsQuerySchema = exports.collectionParamsSchema = exports.updateCollectionSchema = exports.createCollectionSchema = exports.documentTypeSchema = exports.documentContentSchema = exports.documentNameSchema = exports.collectionPermissionSchema = exports.collectionDescriptionSchema = exports.collectionNameSchema = void 0;
const zod_1 = require("zod");
const chat_schemas_1 = require("./chat.schemas");
exports.collectionNameSchema = zod_1.z
    .string({
    required_error: 'Collection name is required',
    invalid_type_error: 'Collection name must be a string',
})
    .min(1, 'Collection name is required')
    .max(100, 'Collection name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Collection name can only contain letters, numbers, spaces, hyphens, and underscores')
    .transform(name => name.trim());
exports.collectionDescriptionSchema = zod_1.z
    .string({
    invalid_type_error: 'Description must be a string',
})
    .max(500, 'Description must be less than 500 characters')
    .transform(desc => desc === null || desc === void 0 ? void 0 : desc.trim())
    .optional();
exports.collectionPermissionSchema = zod_1.z.enum(['public', 'private', 'department'], {
    required_error: 'Permission level is required',
    invalid_type_error: 'Invalid permission level',
});
exports.documentNameSchema = zod_1.z
    .string({
    required_error: 'Document name is required',
    invalid_type_error: 'Document name must be a string',
})
    .min(1, 'Document name is required')
    .max(255, 'Document name must be less than 255 characters')
    .transform(name => name.trim());
exports.documentContentSchema = zod_1.z
    .string({
    required_error: 'Document content is required',
    invalid_type_error: 'Document content must be a string',
})
    .min(1, 'Document content cannot be empty')
    .max(1000000, 'Document content must be less than 1MB');
exports.documentTypeSchema = zod_1.z.enum(['pdf', 'txt', 'docx', 'md'], {
    required_error: 'Document type is required',
    invalid_type_error: 'Invalid document type',
});
exports.createCollectionSchema = zod_1.z.object({
    name: exports.collectionNameSchema,
    description: exports.collectionDescriptionSchema,
    permission: exports.collectionPermissionSchema.default('private'),
    departmentId: chat_schemas_1.mongoIdSchema.optional(),
    tags: zod_1.z
        .array(zod_1.z.string().min(1).max(50))
        .max(10, 'Maximum 10 tags allowed')
        .optional(),
});
exports.updateCollectionSchema = zod_1.z.object({
    name: exports.collectionNameSchema.optional(),
    description: exports.collectionDescriptionSchema,
    permission: exports.collectionPermissionSchema.optional(),
    departmentId: chat_schemas_1.mongoIdSchema.optional(),
    tags: zod_1.z
        .array(zod_1.z.string().min(1).max(50))
        .max(10, 'Maximum 10 tags allowed')
        .optional(),
});
exports.collectionParamsSchema = zod_1.z.object({
    collectionId: chat_schemas_1.mongoIdSchema,
});
exports.getCollectionsQuerySchema = zod_1.z.object({
    page: zod_1.z
        .string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 1)
        .refine(val => val > 0, 'Page must be positive'),
    limit: zod_1.z
        .string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 20)
        .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    search: zod_1.z
        .string()
        .max(100, 'Search query must be less than 100 characters')
        .optional(),
    permission: exports.collectionPermissionSchema.optional(),
    departmentId: chat_schemas_1.mongoIdSchema.optional(),
    tags: zod_1.z
        .string()
        .optional()
        .transform(val => val ? val.split(',').map(tag => tag.trim()) : undefined),
});
exports.uploadDocumentSchema = zod_1.z.object({
    name: exports.documentNameSchema,
    content: exports.documentContentSchema,
    type: exports.documentTypeSchema,
    metadata: zod_1.z
        .object({
        author: zod_1.z.string().max(100).optional(),
        keywords: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
        summary: zod_1.z.string().max(1000).optional(),
    })
        .optional(),
});
exports.updateDocumentSchema = zod_1.z.object({
    name: exports.documentNameSchema.optional(),
    content: exports.documentContentSchema.optional(),
    metadata: zod_1.z
        .object({
        author: zod_1.z.string().max(100).optional(),
        keywords: zod_1.z.array(zod_1.z.string().max(50)).max(20).optional(),
        summary: zod_1.z.string().max(1000).optional(),
    })
        .optional(),
});
exports.documentParamsSchema = zod_1.z.object({
    collectionId: chat_schemas_1.mongoIdSchema,
    documentId: chat_schemas_1.mongoIdSchema,
});
exports.getDocumentsQuerySchema = zod_1.z.object({
    page: zod_1.z
        .string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 1)
        .refine(val => val > 0, 'Page must be positive'),
    limit: zod_1.z
        .string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 20)
        .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    search: zod_1.z
        .string()
        .max(100, 'Search query must be less than 100 characters')
        .optional(),
    type: exports.documentTypeSchema.optional(),
});
exports.searchCollectionSchema = zod_1.z.object({
    query: zod_1.z
        .string({
        required_error: 'Search query is required',
        invalid_type_error: 'Search query must be a string',
    })
        .min(1, 'Search query cannot be empty')
        .max(200, 'Search query must be less than 200 characters'),
    limit: zod_1.z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10),
    threshold: zod_1.z
        .number()
        .min(0)
        .max(1)
        .default(0.7),
});
exports.bulkUploadDocumentsSchema = zod_1.z.object({
    documents: zod_1.z
        .array(exports.uploadDocumentSchema)
        .min(1, 'At least one document is required')
        .max(50, 'Maximum 50 documents allowed per batch'),
});
exports.bulkDeleteDocumentsSchema = zod_1.z.object({
    documentIds: zod_1.z
        .array(chat_schemas_1.mongoIdSchema)
        .min(1, 'At least one document ID is required')
        .max(100, 'Maximum 100 documents can be deleted at once'),
});
//# sourceMappingURL=collection.schemas.js.map