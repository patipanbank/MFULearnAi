import { getConnection } from '../lib/mongodb';
import { Department, IDepartment } from '../models/department';

export class DepartmentService {
  private db = getConnection();

  constructor() {
    console.log('✅ Department service initialized');
  }

  async getAllDepartments(): Promise<IDepartment[]> {
    try {
      return await Department.find().sort({ name: 1 });
    } catch (error) {
      console.error('❌ Error getting departments:', error);
      return [];
    }
  }

  async getDepartmentById(id: string): Promise<IDepartment | null> {
    try {
      return await Department.findById(id);
    } catch (error) {
      console.error('❌ Error getting department:', error);
      return null;
    }
  }

  async createDepartment(departmentData: any): Promise<IDepartment | null> {
    try {
      const department = new Department(departmentData);
      await department.save();
      return department;
    } catch (error) {
      console.error('❌ Error creating department:', error);
      return null;
    }
  }

  async updateDepartment(id: string, updateData: any): Promise<IDepartment | null> {
    try {
      return await Department.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      console.error('❌ Error updating department:', error);
      return null;
    }
  }

  async deleteDepartment(id: string): Promise<boolean> {
    try {
      const result = await Department.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('❌ Error deleting department:', error);
      return false;
    }
  }
}

export const departmentService = new DepartmentService(); 