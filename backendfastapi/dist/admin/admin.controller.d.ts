import { AdminService } from './admin.service';
export declare class AdminController {
    private adminService;
    constructor(adminService: AdminService);
    getSystemStats(): Promise<any>;
    getAllUsers(): Promise<any>;
    getUserById(id: string): Promise<any>;
    updateUserRole(id: string, body: {
        role: string;
    }): Promise<any>;
    updateUserDepartment(id: string, body: {
        department: string;
    }): Promise<any>;
    deleteUser(id: string): Promise<any>;
    getUserStats(): Promise<any>;
    getSystemHealth(): Promise<any>;
    getSystemLogs(body: {
        limit?: number;
    }): Promise<any>;
    clearSystemCache(): Promise<any>;
    backupDatabase(): Promise<any>;
}
