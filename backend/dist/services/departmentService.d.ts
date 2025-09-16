import { IDepartment } from '../models/Department';
import mongoose from 'mongoose';
declare class DepartmentService {
    ensureDepartmentExists(departmentName: string): Promise<IDepartment | null>;
    getAllDepartments(includeInactive?: boolean): Promise<(mongoose.FlattenMaps<IDepartment> & Required<{
        _id: mongoose.FlattenMaps<unknown>;
    }> & {
        __v: number;
    })[]>;
    getDepartmentById(id: string): Promise<(mongoose.FlattenMaps<IDepartment> & Required<{
        _id: mongoose.FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
    getDepartmentByName(name: string): Promise<(mongoose.FlattenMaps<IDepartment> & Required<{
        _id: mongoose.FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
    getDepartmentStats(): Promise<{
        totalDepartments: number;
        activeDepartments: number;
        emptyDepartments: number;
        userStats: {
            totalUsers: any;
            averageUsersPerDepartment: number;
            maxUsersInDepartment: any;
            minUsersInDepartment: any;
        };
        topDepartments: (mongoose.FlattenMaps<IDepartment> & Required<{
            _id: mongoose.FlattenMaps<unknown>;
        }> & {
            __v: number;
        })[];
    }>;
    updateDepartment(id: string, updateData: Partial<IDepartment>): Promise<(mongoose.Document<unknown, {}, IDepartment, {}> & IDepartment & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    createDepartment(departmentData: Partial<IDepartment>): Promise<mongoose.Document<unknown, {}, IDepartment, {}> & IDepartment & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    deleteDepartment(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    recalculateAllUserCounts(): Promise<{
        success: boolean;
        message: string;
    }>;
    onUserCreated(departmentName: string): Promise<void>;
    onUserDeleted(departmentName: string): Promise<void>;
    onUserDepartmentChanged(oldDepartment: string, newDepartment: string): Promise<void>;
}
export declare const departmentService: DepartmentService;
export {};
//# sourceMappingURL=departmentService.d.ts.map