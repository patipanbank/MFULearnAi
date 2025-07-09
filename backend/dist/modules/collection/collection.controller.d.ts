import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionPermission } from './collection-permission.enum';
import { DocumentManagementService } from '../../services/document-management.service';
export declare class CollectionController {
    private readonly collectionService;
    private readonly documentManagementService;
    constructor(collectionService: CollectionService, documentManagementService: DocumentManagementService);
    list(req: any): Promise<import("./collection.schema").CollectionDocument[]>;
    listPublic(): Promise<import("./collection.schema").CollectionDocument[]>;
    create(dto: CreateCollectionDto, req: any): Promise<import("./collection.schema").CollectionDocument>;
    update(id: string, dto: UpdateCollectionDto, req: any): Promise<import("./collection.schema").CollectionDocument>;
    remove(id: string, req: any): Promise<{
        message: string;
    }>;
    uploadDocument(collectionId: string, file: Express.Multer.File, req: any): Promise<{
        message: string;
        data: import("../../services/document-management.service").DocumentUploadResult;
    }>;
    searchDocuments(collectionId: string, query: string, limit: string | undefined, minSimilarity: string | undefined, req: any): Promise<{
        message: string;
        data: import("../../services/document-management.service").DocumentSearchResult;
    }>;
    getDocuments(collectionId: string, limit: string | undefined, req: any): Promise<{
        message: string;
        data: import("../../services/document-management.service").DocumentChunk[];
    }>;
    deleteDocument(collectionId: string, documentId: string, req: any): Promise<{
        message: string;
    }>;
    getCollectionStats(collectionId: string, req: any): Promise<{
        message: string;
        data: {
            collection: {
                id: unknown;
                name: string;
                permission: CollectionPermission;
                createdBy: string;
                department: string | undefined;
                createdAt: Date;
                updatedAt: Date;
            };
            documents: {
                totalDocuments: number;
                totalChunks: number;
                averageChunkSize: number;
                uniqueFileTypes: string[];
            };
        };
    }>;
}
