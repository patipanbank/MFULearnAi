import { IDepartment } from '../models/department';
export declare class DepartmentService {
    private db;
    constructor();
    getAllDepartments(): Promise<IDepartment[]>;
    getDepartmentById(id: string): Promise<IDepartment | null>;
    createDepartment(departmentData: any): Promise<IDepartment | null>;
    updateDepartment(id: string, updateData: any): Promise<IDepartment | null>;
    deleteDepartment(id: string): Promise<boolean>;
}
export declare const departmentService: DepartmentService;
//# sourceMappingURL=departmentService.d.ts.map