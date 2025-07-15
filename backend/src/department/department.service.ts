import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    @InjectModel(Department.name) private departmentModel: Model<Department>,
  ) {}

  async getAllDepartments(): Promise<Department[]> {
    try {
      const departments = await this.departmentModel.find({}).sort({ name: 1 }).exec();
      return departments;
    } catch (error) {
      this.logger.error(`Error getting all departments: ${error}`);
      return [];
    }
  }

  async getDepartmentById(id: string): Promise<Department | null> {
    try {
      const department = await this.departmentModel.findById(id).exec();
      return department;
    } catch (error) {
      this.logger.error(`Error getting department by ID: ${error}`);
      return null;
    }
  }

  async getDepartmentByName(name: string): Promise<Department | null> {
    try {
      const normalizedName = name.toLowerCase().trim();
      const department = await this.departmentModel.findOne({ name: normalizedName }).exec();
      return department;
    } catch (error) {
      this.logger.error(`Error getting department by name: ${error}`);
      return null;
    }
  }

  async createDepartment(departmentData: CreateDepartmentDto): Promise<Department> {
    try {
      // Normalize department name
      const normalizedName = departmentData.name.toLowerCase().trim();
      
      const department = new this.departmentModel({
        ...departmentData,
        name: normalizedName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedDepartment = await department.save();
      return savedDepartment;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Department with this name already exists');
      }
      this.logger.error(`Error creating department: ${error}`);
      throw new Error(`Failed to create department: ${error.message}`);
    }
  }

  async updateDepartment(id: string, departmentData: UpdateDepartmentDto): Promise<Department | null> {
    try {
      const updateData: any = {};
      
      // Only include defined values
      if (departmentData.name !== undefined) {
        updateData.name = departmentData.name.toLowerCase().trim();
      }
      if (departmentData.description !== undefined) {
        updateData.description = departmentData.description;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update');
      }

      updateData.updatedAt = new Date();

      const updatedDepartment = await this.departmentModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      return updatedDepartment;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Department with this name already exists');
      }
      this.logger.error(`Error updating department: ${error}`);
      throw new Error(`Failed to update department: ${error.message}`);
    }
  }

  async deleteDepartment(id: string): Promise<Department | null> {
    try {
      const deletedDepartment = await this.departmentModel.findByIdAndDelete(id).exec();
      return deletedDepartment;
    } catch (error) {
      this.logger.error(`Error deleting department: ${error}`);
      return null;
    }
  }

  async ensureDepartmentExists(departmentName: string): Promise<Department> {
    if (!departmentName || typeof departmentName !== 'string') {
      throw new Error('Invalid department name');
    }

    const normalizedName = departmentName.toLowerCase().trim();
    if (!normalizedName) {
      throw new Error('Department name cannot be empty');
    }

    try {
      // Try to find existing department
      const existingDepartment = await this.getDepartmentByName(normalizedName);
      if (existingDepartment) {
        return existingDepartment;
      }

      // Create new department if it doesn't exist
      const newDepartment = await this.createDepartment({
        name: normalizedName,
        description: `Automatically created department for ${departmentName}`,
      });

      this.logger.log(`✅ Created new department: ${departmentName}`);
      return newDepartment;
    } catch (error) {
      this.logger.error(`❌ Error in ensureDepartmentExists: ${error.message}`);
      throw new Error(`Failed to ensure department exists: ${error.message}`);
    }
  }

  async getDepartmentsByUser(userId: string): Promise<Department[]> {
    try {
      // This would typically query based on user's department access
      // For now, return all departments
      return this.getAllDepartments();
    } catch (error) {
      this.logger.error(`Error getting departments by user: ${error}`);
      return [];
    }
  }

  async validateDepartmentName(name: string): Promise<boolean> {
    try {
      const normalizedName = name.toLowerCase().trim();
      const existingDepartment = await this.getDepartmentByName(normalizedName);
      return !existingDepartment; // Return true if department doesn't exist (name is valid)
    } catch (error) {
      this.logger.error(`Error validating department name: ${error}`);
      return false;
    }
  }
} 