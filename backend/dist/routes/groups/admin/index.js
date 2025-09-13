"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const systemRoutes_1 = __importDefault(require("./systemRoutes"));
const usersRoutes_1 = __importDefault(require("./usersRoutes"));
const analyticsRoutes_1 = __importDefault(require("./analyticsRoutes"));
const router = express_1.default.Router();
exports.adminGroupRoutes = router;
router.use('/system', systemRoutes_1.default);
router.use('/users', usersRoutes_1.default);
router.use('/analytics', analyticsRoutes_1.default);
//# sourceMappingURL=index.js.map