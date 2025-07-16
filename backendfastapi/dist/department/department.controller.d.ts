import { DepartmentService, CreateDepartmentDto, UpdateDepartmentDto } from './department.service';
export declare class DepartmentController {
    private departmentService;
    constructor(departmentService: DepartmentService);
    getAllDepartments(): Promise<any>;
    getDepartmentById(id: string): Promise<any>;
    createDepartment(body: CreateDepartmentDto): Promise<any>;
    updateDepartment(id: string, body: UpdateDepartmentDto): Promise<any>;
    deleteDepartment(id: string): Promise<any>;
    getDepartmentByName(name: string): Promise<any>;
    ensureDepartmentExists(body: {
        name: string;
    }): Promise<any>;
    validateDepartmentName(name: string): Promise<any>;
}
