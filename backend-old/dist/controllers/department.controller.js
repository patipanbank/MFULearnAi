"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.getById = exports.getAll = void 0;
const department_service_1 = require("../services/department.service");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
/**
 * GET /api/departments - Get all departments
 */
exports.getAll = authHandler(async (req, res) => {
    const departments = await (0, department_service_1.getAllDepartments)();
    res.status(200).json(departments);
});
/**
 * GET /api/departments/:id - Get department by ID
 */
exports.getById = authHandler(async (req, res) => {
    const department = await (0, department_service_1.getDepartmentById)(req.params.id);
    if (!department) {
        throw new errors_1.NotFoundError('Department not found');
    }
    res.status(200).json(department);
});
/**
 * POST /api/departments - Create new department (SuperAdmin only)
 */
exports.create = authHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        throw new errors_1.BadRequestError('Department name is required');
    }
    try {
        const department = await (0, department_service_1.createDepartment)({ name, description });
        res.status(201).json(department);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
            throw new errors_1.ConflictError(error.message);
        }
        throw error;
    }
});
/**
 * PUT /api/departments/:id - Update department (SuperAdmin only)
 */
exports.update = authHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name && !description) {
        throw new errors_1.BadRequestError('At least one field is required to update');
    }
    try {
        const department = await (0, department_service_1.updateDepartment)(req.params.id, { name, description });
        if (!department) {
            throw new errors_1.NotFoundError('Department not found');
        }
        res.status(200).json(department);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
            throw new errors_1.ConflictError(error.message);
        }
        throw error;
    }
});
/**
 * DELETE /api/departments/:id - Delete department (SuperAdmin only)
 */
exports.remove = authHandler(async (req, res) => {
    const department = await (0, department_service_1.deleteDepartment)(req.params.id);
    if (!department) {
        throw new errors_1.NotFoundError('Department not found');
    }
    res.status(200).json({
        message: 'Department deleted successfully',
        department,
    });
});
