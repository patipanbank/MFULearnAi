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
const chatController = __importStar(require("../controllers/chat.controller"));
const router = (0, express_1.Router)();
// All chat routes require authentication
router.use(auth_1.authenticate);
// Standard roles that can access chat features
const chatRoles = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];
/**
 * Chat endpoints
 */
// SSE streaming chat
router.post('/', chatController.streamChat);
// Chat history management
router.post('/history', (0, auth_1.authorize)(chatRoles), chatController.saveHistory);
router.get('/chats', (0, auth_1.authorize)(chatRoles), chatController.getChats);
router.get('/chats/:chatId', (0, auth_1.authorize)(chatRoles), chatController.getChat);
router.put('/history/:chatId', (0, auth_1.authorize)(chatRoles), chatController.updateChat);
router.delete('/history/:chatId', (0, auth_1.authorize)(chatRoles), chatController.deleteChat);
// Chat rename and pin
router.put('/history/:chatId/rename', (0, auth_1.authorize)(chatRoles), chatController.validateRenameChat, chatController.renameChat);
router.put('/history/:chatId/pin', (0, auth_1.authorize)(chatRoles), chatController.togglePinChat);
// Export/Import
router.get('/history/:chatId/export', (0, auth_1.authorize)(chatRoles), chatController.exportChat);
router.post('/history/import', (0, auth_1.authorize)(chatRoles), chatController.importChat);
// Clear all history
router.delete('/clear', chatController.clearHistory);
// Add message to existing chat
router.post('/history/:chatId/messages', (0, auth_1.authorize)(chatRoles), chatController.addMessage);
// Edit message
router.post('/edit-message', (0, auth_1.authorize)(chatRoles), chatController.editMessage);
// Usage information
router.get('/usage', chatController.getUsage);
// File parsing
router.post('/parse-file', (0, auth_1.authorize)(chatRoles), chatController.uploadMiddleware.single('file'), chatController.parseFile);
// Collections
router.get('/collections', chatController.getCollections);
exports.default = router;
