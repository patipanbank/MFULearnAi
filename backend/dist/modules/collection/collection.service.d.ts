import { Model } from 'mongoose';
import { CollectionDocument } from './collection.schema';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { UserDocument } from '../users/user.schema';
export declare class CollectionService {
    private readonly collectionModel;
    constructor(collectionModel: Model<CollectionDocument>);
    getAll(): Promise<CollectionDocument[]>;
    findById(id: string): Promise<CollectionDocument | null>;
    create(dto: CreateCollectionDto, user: UserDocument): Promise<CollectionDocument>;
    update(id: string, dto: UpdateCollectionDto): Promise<CollectionDocument>;
    remove(id: string): Promise<void>;
    canUserAccess(user: UserDocument, collection: CollectionDocument): boolean;
    canUserModify(user: UserDocument, collection: CollectionDocument): boolean;
    getUserCollections(user: UserDocument): Promise<CollectionDocument[]>;
}
