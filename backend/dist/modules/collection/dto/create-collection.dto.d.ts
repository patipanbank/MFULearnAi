import { CollectionPermission } from '../collection-permission.enum';
export declare class CreateCollectionDto {
    name: string;
    permission: CollectionPermission;
    modelId?: string;
}
