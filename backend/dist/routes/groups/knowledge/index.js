"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeGroupRoutes = void 0;
const express_1 = __importDefault(require("express"));
const collectionRoutes_1 = __importDefault(require("./collectionRoutes"));
const documentRoutes_1 = __importDefault(require("./documentRoutes"));
const searchRoutes_1 = __importDefault(require("./searchRoutes"));
const embeddingRoutes_1 = __importDefault(require("./embeddingRoutes"));
const router = express_1.default.Router();
exports.knowledgeGroupRoutes = router;
router.use('/collections', collectionRoutes_1.default);
router.use('/documents', documentRoutes_1.default);
router.use('/search', searchRoutes_1.default);
router.use('/embeddings', embeddingRoutes_1.default);
//# sourceMappingURL=index.js.map