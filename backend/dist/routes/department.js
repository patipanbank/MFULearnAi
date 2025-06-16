"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roleGuard_1 = require("../middleware/roleGuard");
const department_service_1 = require("../services/department_service");
const router = (0, express_1.Router)();
// Get all departments
router.get('/', async (req, res) => {
    try {
        const departments = await (0, department_service_1.getAllDepartments)();
        res.status(200).json(departments);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Get department by ID
router.get('/:id', async (req, res) => {
    try {
        const department = await (0, department_service_1.getDepartmentById)(req.params.id);
        if (!department) {
            res.status(404).json({ message: 'Department not found' });
            return;
        }
        res.status(200).json(department);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Create new department (SuperAdmin only)
router.post('/', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            res.status(400).json({ message: 'Department name is required' });
            return;
        }
        const department = await (0, department_service_1.createDepartment)({ name, description });
        res.status(201).json(department);
    }
    catch (error) {
        if (error.message.includes('already exists')) {
            res.status(400).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: error.message });
    }
});
// Update department (SuperAdmin only)
router.put('/:id', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name && !description) {
            res.status(400).json({ message: 'At least one field is required to update' });
            return;
        }
        const department = await (0, department_service_1.updateDepartment)(req.params.id, { name, description });
        if (!department) {
            res.status(404).json({ message: 'Department not found' });
            return;
        }
        res.status(200).json(department);
    }
    catch (error) {
        if (error.message.includes('already exists')) {
            res.status(400).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: error.message });
    }
});
// Delete department (SuperAdmin only)
router.delete('/:id', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const department = await (0, department_service_1.deleteDepartment)(req.params.id);
        if (!department) {
            res.status(404).json({ message: 'Department not found' });
            return;
        }
        res.status(200).json({ message: 'Department deleted successfully', department });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.default = router;
