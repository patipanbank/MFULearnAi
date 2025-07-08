import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
export declare class DepartmentController {
    private readonly deptService;
    constructor(deptService: DepartmentService);
    list(): Promise<(import("mongoose").FlattenMaps<import("./department.schema").DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    })[]>;
    get(id: string): Promise<import("mongoose").FlattenMaps<import("./department.schema").DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    create(dto: CreateDepartmentDto): Promise<import("mongoose").Document<unknown, {}, import("./department.schema").DepartmentDocument, {}> & import("./department.schema").DepartmentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    update(id: string, dto: UpdateDepartmentDto): Promise<import("mongoose").FlattenMaps<import("./department.schema").DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    remove(id: string): Promise<import("mongoose").FlattenMaps<import("./department.schema").DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
}
