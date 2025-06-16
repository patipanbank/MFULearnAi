"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Model_1 = require("../models/Model");
const roleGuard_1 = require("../middleware/roleGuard");
const TrainingHistory_1 = require("../models/TrainingHistory");
const router = (0, express_1.Router)();
/**
 * GET /api/models
 * Retrieves all models (filtered based on user role)
 */
router.get('/', (0, roleGuard_1.roleGuard)(['Students', 'Staffs', 'Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const user = req.user;
        const userId = user.nameID || user.username;
        const userGroups = user.groups || [];
        const userDepartment = user.department;
        const models = await Model_1.ModelModel.find({}).lean();
        const filteredModels = models.filter(model => {
            if (model.modelType === 'official')
                return true;
            if (model.modelType === 'personal' && model.createdBy === userId)
                return true;
            if (model.modelType === 'department' && model.department === userDepartment)
                return true;
            return false;
        });
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
router.post('/', (0, roleGuard_1.roleGuard)(['Students', 'Staffs', 'Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const user = req.user;
        const { name, modelType, department } = req.body;
        if (!name || !modelType) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const userGroups = user.groups || [];
        const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
        if ((modelType === 'official' || modelType === 'department') && !isAdmin) {
            res.status(403).json({ message: 'Only Admin or SuperAdmin can create official or department models' });
            return;
        }
        if (modelType === 'department' && !department) {
            res.status(400).json({ error: 'Department is required for department models' });
            return;
        }
        const createdBy = user.nameID || user.username;
        if (!createdBy) {
            res.status(400).json({ error: 'User identifier not found in token' });
            return;
        }
        const model = await Model_1.ModelModel.create({
            name,
            createdBy,
            modelType,
            department: modelType === 'department' ? department : undefined,
            collections: [],
        });
        res.status(201).json(model);
    }
    catch (error) {
        console.error('Error creating model:', error);
        res.status(500).json({ error: 'Error creating model' });
    }
});
/**
 * PUT /api/models/:id/collections
 * Updates a model's collections
 */
router.put('/:id/collections', (0, roleGuard_1.roleGuard)(['Staffs', 'Admin', 'Students', 'SuperAdmin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { collections } = req.body;
        const user = req.user;
        const model = await Model_1.ModelModel.findById(id);
        if (!model) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        const userGroups = user.groups || [];
        const isOwner = model.createdBy === (user.nameID || user.username);
        const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }
        const updatedCollections = collections.map((collectionName) => ({ name: collectionName }));
        const updatedModel = await Model_1.ModelModel.findByIdAndUpdate(id, { collections: updatedCollections }, { new: true, runValidators: true });
        if (!updatedModel) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        const userId = user.nameID || user.username;
        await Promise.all(collections.map(async (collectionName) => {
            await TrainingHistory_1.TrainingHistory.create({
                userId: userId,
                username: user.username,
                collectionName: collectionName,
                documentName: model.name,
                action: 'update_collection',
                details: {
                    modelId: id,
                    modelName: model.name,
                    collections: collections
                }
            });
        }));
        res.json(updatedModel);
    }
    catch (error) {
        console.error('Error updating model collections:', error);
        res.status(500).json({ error: 'Error updating model collections' });
    }
});
// Other endpoints like GET by ID, DELETE, etc. would go here
exports.default = router;
// NOTE: The generateCollectionDescription function has been permanently removed.
