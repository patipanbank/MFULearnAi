import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from '../models/department.model';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
  ) {}

  async getAllDepartments(): Promise<Department[]> {
    return await this.departmentModel.find({ isActive: true }).exec();
  }

  async getDepartmentById(id: string): Promise<Department> {
    const department = await this.departmentModel.findById(id).exec();
    if (!department) {
      throw new BadRequestException('Department not found');
    }
    return department;
  }

  async createDepartment(name: string): Promise<Department> {
    const department = new this.departmentModel({ name });
    return await department.save();
  }

  async updateDepartment(id: string, name: string): Promise<Department | null> {
    return await this.departmentModel.findByIdAndUpdate(id, { name }, { new: true });
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.departmentModel.findByIdAndUpdate(id, { isActive: false });
  }
} 