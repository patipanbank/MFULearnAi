/**
 * Department Management Controller
 *
 * Handles CRUD operations for departments.
 * Extracted from AuthController to follow Single Responsibility Principle.
 */

import { Request, Response } from 'express';
import Department from '../models/Department';

export class DepartmentController {

    /** GET /api/departments — List all departments */
    static async listDepartments(req: Request, res: Response) {
        try {
            const departments = await Department.find().sort({ name: 1 });
            res.json({ departments });
        } catch (e: any) {
            console.error('[DepartmentController] listDepartments error:', e.message);
            res.status(500).json({ error: 'Failed to fetch departments' });
        }
    }

    /** POST /api/departments — Create department (superadmin) */
    static async createDepartment(req: Request, res: Response) {
        try {
            const { code, name } = req.body;

            const trimmedName = name?.trim();
            if (!trimmedName) return res.status(400).json({ error: 'Department name is required' });
            if (trimmedName.length < 2) return res.status(400).json({ error: 'Department name must be at least 2 characters' });
            if (trimmedName.length > 100) return res.status(400).json({ error: 'Department name must not exceed 100 characters' });

            const deptCode = code?.trim() || trimmedName.toUpperCase().replace(/\s+/g, '_');

            const existing = await Department.findOne({ code: deptCode });
            if (existing) {
                return res.status(409).json({ error: `Department with code "${deptCode}" already exists` });
            }

            const newDept = await Department.create({ code: deptCode, name: trimmedName });
            res.status(201).json({ department: newDept });
        } catch (e: any) {
            if (e.code === 11000) {
                return res.status(409).json({ error: 'A department with this name or code already exists' });
            }
            console.error('[DepartmentController] createDepartment error:', e.message);
            res.status(500).json({ error: 'Failed to create department' });
        }
    }

    /** PUT /api/departments/:id — Update department (superadmin) */
    static async updateDepartment(req: Request, res: Response) {
        try {
            const { name } = req.body;

            const trimmedName = name?.trim();
            if (!trimmedName) return res.status(400).json({ error: 'Department name is required' });
            if (trimmedName.length < 2) return res.status(400).json({ error: 'Department name must be at least 2 characters' });
            if (trimmedName.length > 100) return res.status(400).json({ error: 'Department name must not exceed 100 characters' });

            const dept = await Department.findByIdAndUpdate(
                req.params.id,
                { name: trimmedName },
                { new: true }
            );

            if (!dept) {
                return res.status(404).json({ error: 'Department not found' });
            }

            res.json({ department: dept });
        } catch (e: any) {
            console.error('[DepartmentController] updateDepartment error:', e.message);
            res.status(500).json({ error: 'Failed to update department' });
        }
    }

    /** DELETE /api/departments/:id — Delete department (superadmin) */
    static async deleteDepartment(req: Request, res: Response) {
        try {
            const dept = await Department.findByIdAndDelete(req.params.id);
            if (!dept) {
                return res.status(404).json({ error: 'Department not found' });
            }
            res.json({ success: true });
        } catch (e: any) {
            console.error('[DepartmentController] deleteDepartment error:', e.message);
            res.status(500).json({ error: 'Failed to delete department' });
        }
    }
}
