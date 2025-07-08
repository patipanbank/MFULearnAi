import { Model } from 'mongoose';
import { RefreshTokenDocument } from './refresh-token.schema';
export declare class RefreshTokenService {
    private readonly model;
    private ttlDays;
    constructor(model: Model<RefreshTokenDocument>);
    create(userId: string): Promise<string>;
    verify(token: string): Promise<string | null>;
    rotate(oldToken: string): Promise<{
        userId: string;
        token: string;
    } | null>;
}
