import Department, { IDepartment } from '../models/Department';
import { NotFoundError, ConflictError, InternalError } from '../errors';

export interface CreateDepartmentParams {
  name: string;
  description?: string;
}

export interface UpdateDepartmentParams {
  name?: string;
  description?: string;
}

/**
 * Get all departments
 */
export async function getAllDepartments(): Promise<IDepartment[]> {
  try {
    return await Department.find().sort({ name: 1 });
  } catch (error) {
    throw new InternalError(`Failed to fetch departments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get department by ID
 */
export async function getDepartmentById(id: string): Promise<IDepartment | null> {
  try {
    const department = await Department.findById(id);
    return department;
  } catch (error) {
    throw new InternalError(`Failed to fetch department: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get department by name
 */
export async function getDepartmentByName(name: string): Promise<IDepartment | null> {
  try {
    const department = await Department.findOne({ name });
    return department;
  } catch (error) {
    throw new InternalError(`Failed to fetch department by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create new department
 */
export async function createDepartment(departmentData: CreateDepartmentParams): Promise<IDepartment> {
  try {
    const department = new Department(departmentData);
    return await department.save();
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ConflictError('Department with this name already exists');
    }
    throw new InternalError(`Failed to create department: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Update department
 */
export async function updateDepartment(id: string, departmentData: UpdateDepartmentParams): Promise<IDepartment | null> {
  try {
    const department = await Department.findByIdAndUpdate(id, departmentData, {
      new: true,
      runValidators: true,
    });
    return department;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ConflictError('Department with this name already exists');
    }
    throw new InternalError(`Failed to update department: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Delete department
 */
export async function deleteDepartment(id: string): Promise<IDepartment | null> {
  try {
    const department = await Department.findByIdAndDelete(id);
    return department;
  } catch (error) {
    throw new InternalError(`Failed to delete department: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
