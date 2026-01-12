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
const rateLimiter_1 = require("../middleware/rateLimiter");
const inputValidation_1 = require("../middleware/inputValidation");
const trainingController = __importStar(require("../controllers/training.controller"));
const chroma_1 = require("../services/chroma");
const router = (0, express_1.Router)();
// Ensure default collection exists when server starts
chroma_1.chromaService.ensureDefaultCollection().catch((error) => {
    console.error('Failed to create default collection:', error);
});
// All training routes require authentication
router.use(auth_1.authenticate);
// Standard roles that can access training features
const allowedRoles = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];
/**
 * File Upload Endpoints
 */
router.post('/upload', (0, auth_1.authorize)(allowedRoles), (0, rateLimiter_1.createRateLimitMiddleware)(rateLimiter_1.uploadRateLimiter), trainingController.uploadMiddleware.single('file'), trainingController.uploadFile);
router.post('/documents', (0, auth_1.authorize)(allowedRoles), (0, rateLimiter_1.createRateLimitMiddleware)(rateLimiter_1.uploadRateLimiter), trainingController.uploadMiddleware.single('file'), trainingController.uploadDocument);
/**
 * Collection Endpoints
 */
router.get('/collections', (0, auth_1.authorize)(allowedRoles), trainingController.getCollections);
router.post('/collections', (0, auth_1.authorize)(allowedRoles), inputValidation_1.sanitizeRequestBody, inputValidation_1.validateCollectionName, inputValidation_1.validatePermission, inputValidation_1.checkValidation, trainingController.createCollection);
router.put('/collections/:id', (0, auth_1.authorize)(allowedRoles), trainingController.updateCollection);
router.delete('/collections/:id', (0, auth_1.authorize)(allowedRoles), trainingController.deleteCollection);
router.delete('/collections', (0, auth_1.authorize)(allowedRoles), trainingController.deleteCollections);
/**
 * Document Endpoints
 */
router.get('/documents', (0, auth_1.authorize)(allowedRoles), trainingController.getDocuments);
router.get('/documents/:filename/content', (0, auth_1.authorize)(allowedRoles), trainingController.getDocumentContent);
router.delete('/documents/:id', (0, auth_1.authorize)(allowedRoles), trainingController.deleteDocument);
router.delete('/documents/all/:collectionName', (0, auth_1.authorize)(allowedRoles), trainingController.deleteAllDocuments);
/**
 * URL Processing
 */
router.post('/add-urls', (0, auth_1.authorize)(allowedRoles), trainingController.addUrls);
/**
 * Cleanup
 */
router.delete('/cleanup', (0, auth_1.authorize)(allowedRoles), trainingController.cleanup);
/**
 * History
 */
router.get('/history', (0, auth_1.authorize)(allowedRoles), trainingController.getHistory);
exports.default = router;
