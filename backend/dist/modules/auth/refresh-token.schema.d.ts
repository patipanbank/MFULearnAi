import { Schema, Document } from 'mongoose';
export interface RefreshTokenDocument extends Document {
    userId: string;
    token: string;
    expiresAt: Date;
}
export declare const RefreshTokenSchema: Schema<RefreshTokenDocument, import("mongoose").Model<RefreshTokenDocument, any, any, any, Document<unknown, any, RefreshTokenDocument, any> & RefreshTokenDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RefreshTokenDocument, Document<unknown, {}, import("mongoose").FlatRecord<RefreshTokenDocument>, {}> & import("mongoose").FlatRecord<RefreshTokenDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
