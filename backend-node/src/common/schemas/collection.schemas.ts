import { z } from 'zod';
import { mongoIdSchema } from './chat.schemas';

// Collection validation schemas
export const collectionNameSchema = z
  .string({
    required_error: 'Collection name is required',
    invalid_type_error: 'Collection name must be a string',
  })
  .min(1, 'Collection name is required')
  .max(100, 'Collection name must be less than 100 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Collection name can only contain letters, numbers, spaces, hyphens, and underscores')
  .transform(name => name.trim());

export const collectionDescriptionSchema = z
  .string({
    invalid_type_error: 'Description must be a string',
  })
  .max(500, 'Description must be less than 500 characters')
  .transform(desc => desc?.trim())
  .optional();

export const collectionPermissionSchema = z.enum(['public', 'private', 'department'], {
  required_error: 'Permission level is required',
  invalid_type_error: 'Invalid permission level',
});

// Document validation schemas
export const documentNameSchema = z
  .string({
    required_error: 'Document name is required',
    invalid_type_error: 'Document name must be a string',
  })
  .min(1, 'Document name is required')
  .max(255, 'Document name must be less than 255 characters')
  .transform(name => name.trim());

export const documentContentSchema = z
  .string({
    required_error: 'Document content is required',
    invalid_type_error: 'Document content must be a string',
  })
  .min(1, 'Document content cannot be empty')
  .max(1000000, 'Document content must be less than 1MB');

export const documentTypeSchema = z.enum(['pdf', 'txt', 'docx', 'md'], {
  required_error: 'Document type is required',
  invalid_type_error: 'Invalid document type',
});

// Collection DTO Schemas
export const createCollectionSchema = z.object({
  name: collectionNameSchema,
  description: collectionDescriptionSchema,
  permission: collectionPermissionSchema.default('private'),
  departmentId: mongoIdSchema.optional(),
  tags: z
    .array(z.string().min(1).max(50))
    .max(10, 'Maximum 10 tags allowed')
    .optional(),
});

export const updateCollectionSchema = z.object({
  name: collectionNameSchema.optional(),
  description: collectionDescriptionSchema,
  permission: collectionPermissionSchema.optional(),
  departmentId: mongoIdSchema.optional(),
  tags: z
    .array(z.string().min(1).max(50))
    .max(10, 'Maximum 10 tags allowed')
    .optional(),
});

export const collectionParamsSchema = z.object({
  collectionId: mongoIdSchema,
});

export const getCollectionsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val > 0, 'Page must be positive'),
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  search: z
    .string()
    .max(100, 'Search query must be less than 100 characters')
    .optional(),
  permission: collectionPermissionSchema.optional(),
  departmentId: mongoIdSchema.optional(),
  tags: z
    .string()
    .optional()
    .transform(val => val ? val.split(',').map(tag => tag.trim()) : undefined),
});

// Document DTO Schemas
export const uploadDocumentSchema = z.object({
  name: documentNameSchema,
  content: documentContentSchema,
  type: documentTypeSchema,
  metadata: z
    .object({
      author: z.string().max(100).optional(),
      keywords: z.array(z.string().max(50)).max(20).optional(),
      summary: z.string().max(1000).optional(),
    })
    .optional(),
});

export const updateDocumentSchema = z.object({
  name: documentNameSchema.optional(),
  content: documentContentSchema.optional(),
  metadata: z
    .object({
      author: z.string().max(100).optional(),
      keywords: z.array(z.string().max(50)).max(20).optional(),
      summary: z.string().max(1000).optional(),
    })
    .optional(),
});

export const documentParamsSchema = z.object({
  collectionId: mongoIdSchema,
  documentId: mongoIdSchema,
});

export const getDocumentsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val > 0, 'Page must be positive'),
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  search: z
    .string()
    .max(100, 'Search query must be less than 100 characters')
    .optional(),
  type: documentTypeSchema.optional(),
});

// Search schemas
export const searchCollectionSchema = z.object({
  query: z
    .string({
      required_error: 'Search query is required',
      invalid_type_error: 'Search query must be a string',
    })
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query must be less than 200 characters'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.7),
});

// Bulk operations schemas
export const bulkUploadDocumentsSchema = z.object({
  documents: z
    .array(uploadDocumentSchema)
    .min(1, 'At least one document is required')
    .max(50, 'Maximum 50 documents allowed per batch'),
});

export const bulkDeleteDocumentsSchema = z.object({
  documentIds: z
    .array(mongoIdSchema)
    .min(1, 'At least one document ID is required')
    .max(100, 'Maximum 100 documents can be deleted at once'),
});

// Type inference
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