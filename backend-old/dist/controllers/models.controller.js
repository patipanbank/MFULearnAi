"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelById = exports.deleteModel = exports.updateModelCollections = exports.createModel = exports.getAllModels = void 0;
const Model_1 = require("../models/Model");
const TrainingHistory_1 = require("../models/TrainingHistory");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
/**
 * Filter models based on user permissions
 */
function filterModelsByUser(models, user) {
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
    const userDepartment = user.department;
    return models.filter(model => {
        // Official models - everyone can see
        if (model.modelType === 'official') {
            return true;
        }
        // Personal models - only owner
        if (model.modelType === 'personal' && model.createdBy === userId) {
            return true;
        }
        // Department models - only same department
        if (model.modelType === 'department' && model.department === userDepartment) {
            return true;
        }
        return false;
    });
}
/**
 * GET /api/models - Get all models (filtered by user permissions)
 */
exports.getAllModels = authHandler(async (req, res) => {
    const models = await Model_1.ModelModel.find({}).lean();
    const filteredModels = filterModelsByUser(models, req.user);
    res.json(filteredModels);
});
/**
 * POST /api/models - Create a new model
 */
exports.createModel = authHandler(async (req, res) => {
    const { name, modelType, department } = req.body;
    const user = req.user;
    if (!name || !modelType) {
        throw new errors_1.BadRequestError('Missing required fields: name and modelType');
    }
    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
    // Only Admin or SuperAdmin can create official or department models
    if ((modelType === 'official' || modelType === 'department') && !isAdmin) {
        throw new errors_1.ForbiddenError('Only Admin or SuperAdmin can create official or department models');
    }
    // Department models require a department field
    if (modelType === 'department' && !department) {
        throw new errors_1.BadRequestError('Department is required for department models');
    }
    const createdBy = user.nameID || user.username;
    if (!createdBy) {
        throw new errors_1.BadRequestError('User identifier not found in token');
    }
    const model = await Model_1.ModelModel.create({
        name,
        createdBy,
        modelType,
        department: modelType === 'department' ? department : undefined,
        collections: [],
    });
    res.status(201).json(model);
});
/**
 * PUT /api/models/:id/collections - Update model's collections
 */
exports.updateModelCollections = authHandler(async (req, res) => {
    const { id } = req.params;
    const { collections } = req.body;
    const user = req.user;
    const model = await Model_1.ModelModel.findById(id);
    if (!model) {
        throw new errors_1.NotFoundError('Model not found');
    }
    // Check permissions
    const userGroups = user.groups || [];
    const isStaff = userGroups.includes('Staffs') ||
        userGroups.includes('Admin') ||
        userGroups.includes('Students') ||
        userGroups.includes('SuperAdmin');
    const isOwner = model.createdBy === (user.nameID || user.username);
    if (!isStaff && !isOwner) {
        throw new errors_1.ForbiddenError('Permission denied');
    }
    const updatedModel = await Model_1.ModelModel.findByIdAndUpdate(id, { collections }, { new: true, runValidators: true });
    if (!updatedModel) {
        throw new errors_1.NotFoundError('Model not found');
    }
    // Create training history entries
    const userId = user.nameID || user.username;
    if (!userId) {
        throw new errors_1.BadRequestError('User identifier not found');
    }
    await Promise.all(collections.map(async (collectionName) => {
        await TrainingHistory_1.TrainingHistory.create({
            userId,
            username: user.username,
            collectionName,
            documentName: model.name,
            action: 'update_collection',
            details: {
                modelId: id,
                modelName: model.name,
                collections,
            },
        });
    }));
    res.json(updatedModel);
});
/**
 * DELETE /api/models/:id - Delete a model
 */
exports.deleteModel = authHandler(async (req, res) => {
    const { id } = req.params;
    const model = await Model_1.ModelModel.findByIdAndDelete(id);
    if (!model) {
        throw new errors_1.NotFoundError('Model not found');
    }
    res.json({ message: 'Model deleted successfully' });
});
/**
 * GET /api/models/:id - Get model details
 */
exports.getModelById = authHandler(async (req, res) => {
    const { id } = req.params;
    const model = await Model_1.ModelModel.findById(id);
    if (!model) {
        throw new errors_1.NotFoundError('Model not found');
    }
    res.json(model);
});
