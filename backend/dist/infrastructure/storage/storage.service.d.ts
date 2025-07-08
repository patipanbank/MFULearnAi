export declare class StorageService {
    private readonly s3;
    private readonly bucket;
    private readonly publicEndpoint;
    constructor();
    upload(key: string, body: Buffer | Uint8Array | Blob | string): Promise<{
        key: string;
        url: string;
    }>;
    get(key: string): Promise<import("@aws-sdk/client-s3").GetObjectCommandOutput>;
    delete(key: string): Promise<void>;
    getPublicUrl(key: string): string;
}
