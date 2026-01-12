import { Response } from 'express';
import { AuthenticatedRequest } from '../types/common';
import { 
  getAllDepartments, 
  getDepartmentById, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment,
} from '../services/department.service';
import { asyncHandler } from '../middleware/errorHandler';
import { BadRequestError, NotFoundError, ConflictError } from '../errors';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) => 
  asyncHandler<AuthenticatedRequest>(fn);

/**
 * GET /api/departments - Get all departments
 */
export const getAll = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const departments = await getAllDepartments();
  res.status(200).json(departments);
});

/**
 * GET /api/departments/:id - Get department by ID
 */
export const getById = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const department = await getDepartmentById(req.params.id);
  if (!department) {
    throw new NotFoundError('Department not found');
  }
  res.status(200).json(department);
});

/**
 * POST /api/departments - Create new department (SuperAdmin only)
 */
export const create = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { name, description } = req.body;
  
  if (!name) {
    throw new BadRequestError('Department name is required');
  }
  
  try {
    const department = await createDepartment({ name, description });
    res.status(201).json(department);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
});

/**
 * PUT /api/departments/:id - Update department (SuperAdmin only)
 */
export const update = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { name, description } = req.body;
  
  if (!name && !description) {
    throw new BadRequestError('At least one field is required to update');
  }
  
  try {
    const department = await updateDepartment(req.params.id, { name, description });
    
    if (!department) {
      throw new NotFoundError('Department not found');
    }
    
    res.status(200).json(department);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
});

/**
 * DELETE /api/departments/:id - Delete department (SuperAdmin only)
 */
export const remove = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const department = await deleteDepartment(req.params.id);
  
  if (!department) {
    throw new NotFoundError('Department not found');
  }
  
  res.status(200).json({ 
    message: 'Department deleted successfully', 
    department,
  });
});
