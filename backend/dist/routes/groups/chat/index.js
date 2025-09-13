"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatGroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const chatRoutes_1 = require("./chatRoutes");
const messageRoutes_1 = require("./messageRoutes");
const sessionRoutes_1 = require("./sessionRoutes");
const router = express_1.default.Router();
exports.chatGroupRoutes = router;
router.use('/', chatRoutes_1.chatRoutes);
router.use('/messages', messageRoutes_1.messageRoutes);
router.use('/sessions', sessionRoutes_1.sessionRoutes);
//# sourceMappingURL=index.js.map