import { Model } from 'mongoose';
import { User } from '../models/user.model';
import { Collection } from '../models/collection.model';
import { Department } from '../models/department.model';
import { Chat } from '../models/chat.model';
import { Agent } from '../models/agent.model';
export interface SystemStats {
    totalUsers: number;
    totalCollections: number;
    totalDepartments: number;
    totalChats: number;
    totalAgents: number;
    activeUsers: number;
    systemHealth: string;
}
export interface UserStats {
    userId: string;
    username: string;
    email: string;
    role: string;
    department: string;
    totalChats: number;
    lastActive: Date;
    createdAt: Date;
}
export declare class AdminService {
    private userModel;
    private collectionModel;
    private departmentModel;
    private chatModel;
    private agentModel;
    private readonly logger;
    constructor(userModel: Model<User>, collectionModel: Model<Collection>, departmentModel: Model<Department>, chatModel: Model<Chat>, agentModel: Model<Agent>);
    getSystemStats(): Promise<SystemStats>;
    getAllUsers(): Promise<User[]>;
    getUserById(userId: string): Promise<User | null>;
    updateUserRole(userId: string, newRole: string): Promise<User | null>;
    updateUserDepartment(userId: string, newDepartment: string): Promise<User | null>;
    deleteUser(userId: string): Promise<boolean>;
    getUserStats(): Promise<UserStats[]>;
    getSystemHealth(): Promise<any>;
    getSystemLogs(limit?: number): Promise<any[]>;
    clearSystemCache(): Promise<boolean>;
    backupDatabase(): Promise<string>;
}
