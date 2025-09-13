"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentGroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const agentRoutes_1 = require("./agentRoutes");
const templateRoutes_1 = __importDefault(require("./templateRoutes"));
const executionRoutes_1 = __importDefault(require("./executionRoutes"));
const router = express_1.default.Router();
exports.agentGroupRoutes = router;
router.use('/', agentRoutes_1.agentRoutes);
router.use('/templates', templateRoutes_1.default);
router.use('/executions', executionRoutes_1.default);
//# sourceMappingURL=index.js.map