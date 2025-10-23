declare class UserService {
    get_user_by_id(user_id: string): Promise<any>;
    get_all_admins(): Promise<any>;
    find_admin_by_username(username: string): Promise<any>;
    verify_admin_password(password: string, hashed_password: string): Promise<boolean>;
    find_or_create_saml_user(profile: any): Promise<any>;
}
export declare const userService: UserService;
export {};
//# sourceMappingURL=userService.d.ts.map