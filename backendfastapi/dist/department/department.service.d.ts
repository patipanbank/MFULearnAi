import { Model } from 'mongoose';
import { Department } from '../models/department.model';
export interface CreateDepartmentDto {
    name: string;
    description?: string;
}
export interface UpdateDepartmentDto {
    name?: string;
    description?: string;
}
export declare class DepartmentService {
    private departmentModel;
    private readonly logger;
    constructor(departmentModel: Model<Department>);
    getAllDepartments(): Promise<Department[]>;
    getDepartmentById(id: string): Promise<Department | null>;
    getDepartmentByName(name: string): Promise<Department | null>;
    createDepartment(departmentData: CreateDepartmentDto): Promise<Department>;
    updateDepartment(id: string, departmentData: UpdateDepartmentDto): Promise<Department | null>;
    deleteDepartment(id: string): Promise<Department | null>;
    ensureDepartmentExists(departmentName: string): Promise<Department>;
    getDepartmentsByUser(userId: string): Promise<Department[]>;
    validateDepartmentName(name: string): Promise<boolean>;
}
