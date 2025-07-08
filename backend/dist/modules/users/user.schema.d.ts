import { Schema, Document } from 'mongoose';
export interface UserDocument extends Document {
    username: string;
    password: string;
    roles: string[];
    department?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    comparePassword(password: string): Promise<boolean>;
}
declare const UserSchema: Schema<UserDocument, import("mongoose").Model<UserDocument, any, any, any, Document<unknown, any, UserDocument, any> & UserDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, UserDocument, Document<unknown, {}, import("mongoose").FlatRecord<UserDocument>, {}> & import("mongoose").FlatRecord<UserDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export { UserSchema };
