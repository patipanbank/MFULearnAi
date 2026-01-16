"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const modelsController = __importStar(require("../controllers/models.controller"));
const router = (0, express_1.Router)();
// All model routes require authentication
router.use(auth_1.authenticate);
// Standard roles that can access models
const allowedRoles = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];
/**
 * GET /api/models - Get all models (filtered by user permissions)
 */
router.get('/', (0, auth_1.authorize)(allowedRoles), modelsController.getAllModels);
/**
 * POST /api/models - Create a new model
 */
router.post('/', (0, auth_1.authorize)(allowedRoles), modelsController.createModel);
/**
 * PUT /api/models/:id/collections - Update model's collections
 */
router.put('/:id/collections', (0, auth_1.authorize)(allowedRoles), modelsController.updateModelCollections);
/**
 * DELETE /api/models/:id - Delete a model
 */
router.delete('/:id', (0, auth_1.authorize)(allowedRoles), modelsController.deleteModel);
/**
 * GET /api/models/:id - Get model details
 */
router.get('/:id', (0, auth_1.authorize)(allowedRoles), modelsController.getModelById);
exports.default = router;
