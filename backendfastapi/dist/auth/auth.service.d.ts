import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../models/user.model';
import { ConfigService } from '../config/config.service';
export interface JwtPayload {
    sub: string;
    nameID: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    department?: string;
    groups?: string[];
}
export declare class AuthService {
    private userModel;
    private jwtService;
    private configService;
    constructor(userModel: Model<UserDocument>, jwtService: JwtService, configService: ConfigService);
    validateUser(username: string, password: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            nameID: any;
            username: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            department: any;
            groups: any;
        };
    }>;
    createJwtToken(user: any): Promise<string>;
    getUserById(userId: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    getUserByNameID(nameID: string): Promise<User | null>;
    createUser(userData: Partial<User>): Promise<User>;
    updateUser(userId: string, updateData: Partial<User>): Promise<User | null>;
    refreshToken(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            nameID: any;
            username: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            department: any;
            groups: any;
        };
    }>;
    private comparePasswords;
}
