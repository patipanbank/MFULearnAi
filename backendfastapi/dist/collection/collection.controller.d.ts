import { CollectionService, CreateCollectionDto, UpdateCollectionDto } from './collection.service';
export declare class CollectionController {
    private collectionService;
    constructor(collectionService: CollectionService);
    getAllCollections(req: any): Promise<any>;
    getCollectionById(id: string, req: any): Promise<any>;
    createCollection(body: CreateCollectionDto, req: any): Promise<any>;
    updateCollection(id: string, body: UpdateCollectionDto, req: any): Promise<any>;
    deleteCollection(id: string, req: any): Promise<any>;
    getUserCollections(req: any): Promise<any>;
    getCollectionsByDepartment(department: string): Promise<any>;
    getCollectionsByCreator(username: string): Promise<any>;
}
