/**
 * User Management Controller
 *
 * Handles CRUD operations for user accounts (admin/superadmin only).
 * Extracted from AuthController to follow Single Responsibility Principle.
 */

import { Request, Response } from 'express';
import User from '../models/User';
import Department from '../models/Department';
import bcrypt from 'bcryptjs';

export class UserController {

    /** GET /api/users — List all users (admin+) */
    static async listUsers(req: Request, res: Response) {
        try {
            const users = await User.find().select('-password').sort({ createdAt: -1 });
            res.json({ users });
        } catch (e: any) {
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    /** POST /api/users — Create a new user (superadmin) */
    static async createUser(req: Request, res: Response) {
        try {
            const { username, password, role, department, firstName, lastName, isActive } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Required fields missing' });

            if (await User.findOne({ username })) return res.status(400).json({ error: 'Username exists' });

            const hashedPassword = await bcrypt.hash(password, 10);

            // Resolve department ID
            let departmentId = '';
            if (department) {
                const existingDept = await Department.findOne({ name: department });
                departmentId = existingDept ? existingDept.code : department.trim().toUpperCase().replace(/\s+/g, '_');

                await Department.findOneAndUpdate(
                    { code: departmentId }, { code: departmentId, name: department },
                    { upsert: true, setDefaultsOnInsert: true }
                );
            }

            const newUser = await User.create({
                username, password: hashedPassword, role: role || 'student',
                department, departmentId, firstName, lastName, isActive: isActive ?? true,
                email: req.body.email || `${username}@local.domain`
            });

            res.json({ user: newUser });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    /** PUT /api/users/:id — Update user (superadmin) */
    static async updateUser(req: Request, res: Response) {
        try {
            const { role, department, isActive, firstName, lastName } = req.body;
            const updateData: any = {};
            if (role) updateData.role = role;
            if (typeof isActive === 'boolean') updateData.isActive = isActive;
            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;

            if (department) {
                updateData.department = department;
                const existingDept = await Department.findOne({ name: department });
                updateData.departmentId = existingDept ? existingDept.code : department.trim().toUpperCase().replace(/\s+/g, '_');

                await Department.findOneAndUpdate(
                    { code: updateData.departmentId }, { code: updateData.departmentId, name: department },
                    { upsert: true, setDefaultsOnInsert: true }
                );
            }

            const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
            res.json({ user });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    /** DELETE /api/users/:id — Delete user (superadmin) */
    static async deleteUser(req: Request, res: Response) {
        try {
            await User.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    /** GET /api/users/me — Get current user profile */
    static async me(req: any, res: Response) {
        try {
            const user = await User.findById(req.user.userId).select('-password');
            if (!user) return res.status(404).json({ error: 'User not found' });
            res.json({ user });
        } catch (e) {
            res.status(500).json({ error: 'Server Error' });
        }
    }
}
