import { Model } from 'mongoose';
import { DepartmentDocument } from './department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
export declare class DepartmentService {
    private readonly deptModel;
    constructor(deptModel: Model<DepartmentDocument>);
    findAll(): Promise<(import("mongoose").FlattenMaps<DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    })[]>;
    findById(id: string): Promise<import("mongoose").FlattenMaps<DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    findByName(name: string): Promise<(import("mongoose").FlattenMaps<DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }) | null>;
    create(dto: CreateDepartmentDto): Promise<import("mongoose").Document<unknown, {}, DepartmentDocument, {}> & DepartmentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    update(id: string, dto: UpdateDepartmentDto): Promise<import("mongoose").FlattenMaps<DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
    delete(id: string): Promise<import("mongoose").FlattenMaps<DepartmentDocument> & Required<{
        _id: import("mongoose").FlattenMaps<unknown>;
    }> & {
        __v: number;
    }>;
}
