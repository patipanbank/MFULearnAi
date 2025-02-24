"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Model_1 = require("../models/Model");
const roleGuard_1 = require("../middleware/roleGuard");
const router = (0, express_1.Router)();
/**
 * GET /api/models
 * Retrieves all models (filtered based on user role)
 */
router.get('/', (0, roleGuard_1.roleGuard)(['Students', 'Staffs', 'Admin']), async (req, res) => {
    try {
        const user = req.user;
        console.log('User in models route:', user);
        // Check if user has staff privileges from groups array
        const userGroups = user.groups || [];
        const isStaff = userGroups.includes('Staffs') || userGroups.includes('Admin');
        // Get all models
        const models = await Model_1.ModelModel.find({}).lean();
        console.log('Found models:', models);
        // Filter models based on user groups
        const filteredModels = models.filter(model => model.modelType === 'official' ||
            (model.modelType === 'staff_only' && isStaff) ||
            (model.modelType === 'personal' && model.createdBy === user.nameID));
        console.log('Filtered models:', filteredModels);
        res.json(filteredModels);
    }
    catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: 'Error fetching models' });
    }
});
/**
 * POST /api/models
 * Creates a new model
 */
router.post('/', (0, roleGuard_1.roleGuard)(['Students', 'Staffs', 'Admin']), async (req, res) => {
    try {
        const user = req.user;
        const { name, modelType } = req.body;
        // Validate required fields
        if (!name || !modelType) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        // Check if user has staff privileges from groups array
        const userGroups = user.groups || [];
        const isStaff = userGroups.includes('Staffs') || userGroups.includes('Admin');
        // Only staff can create official or staff_only models
        if ((modelType === 'official' || modelType === 'staff_only') && !isStaff) {
            res.status(403).json({ message: 'Only staff can create official or staff-only models' });
            return;
        }
        // For admin users, use username as createdBy since they don't have nameID
        const createdBy = user.nameID || user.username;
        if (!createdBy) {
            res.status(400).json({ error: 'User identifier not found in token' });
            return;
        }
        // Create the model with empty collections array
        const model = await Model_1.ModelModel.create({
            name,
            createdBy,
            modelType,
            collections: [], // Start with empty collections array
        });
        res.status(201).json(model);
    }
    catch (error) {
        console.error('Error creating model:', error);
        res.status(500).json({ error: 'Error creating model' });
    }
});
/**
 * PUT /api/models/:id
 * Updates a model's collections
 */
router.put('/:id', (0, roleGuard_1.roleGuard)(['Staffs', 'Admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { collections } = req.body;
        const model = await Model_1.ModelModel.findByIdAndUpdate(id, { collections }, { new: true });
        if (!model) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        res.json(model);
    }
    catch (error) {
        console.error('Error updating model:', error);
        res.status(500).json({ error: 'Error updating model' });
    }
});
/**
 * DELETE /api/models/:id
 * Deletes a model
 */
router.delete('/:id', (0, roleGuard_1.roleGuard)(['Staffs', 'Admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const model = await Model_1.ModelModel.findByIdAndDelete(id);
        if (!model) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        res.json({ message: 'Model deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting model:', error);
        res.status(500).json({ error: 'Error deleting model' });
    }
});
/**
 * GET /api/models/:id
 * Gets a model's details
 */
router.get('/:id', (0, roleGuard_1.roleGuard)(['Students', 'Staffs', 'Admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const model = await Model_1.ModelModel.findById(id);
        if (!model) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        res.json(model);
    }
    catch (error) {
        console.error('Error fetching model:', error);
        res.status(500).json({ error: 'Error fetching model' });
    }
});
exports.default = router;
