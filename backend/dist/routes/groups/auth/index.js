"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const userRoutes_1 = __importDefault(require("./userRoutes"));
const sessionRoutes_1 = __importDefault(require("./sessionRoutes"));
const router = express_1.default.Router();
exports.authGroupRoutes = router;
router.use('/', authRoutes_1.default);
router.use('/users', userRoutes_1.default);
router.use('/sessions', sessionRoutes_1.default);
//# sourceMappingURL=index.js.map