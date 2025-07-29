import { IUser } from '../models/user';
export declare class UserService {
    private db;
    constructor();
    getAllUsers(): Promise<IUser[]>;
    getUserById(id: string): Promise<IUser | null>;
    getUserByEmail(email: string): Promise<IUser | null>;
    createUser(userData: any): Promise<IUser | null>;
    updateUser(id: string, updateData: any): Promise<IUser | null>;
    deleteUser(id: string): Promise<boolean>;
    getAdmins(): Promise<IUser[]>;
    getUserStats(): Promise<any>;
    find_or_create_saml_user(userProfile: any): Promise<IUser>;
    find_admin_by_username(username: string): Promise<IUser | null>;
    verify_admin_password(password: string, hashedPassword: string): Promise<boolean>;
}
export declare const userService: UserService;
//# sourceMappingURL=userService.d.ts.map