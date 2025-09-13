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
exports.routeGroups = exports.adminGroupRoutes = exports.authGroupRoutes = exports.knowledgeGroupRoutes = exports.agentGroupRoutes = exports.chatGroupRoutes = void 0;
var chat_1 = require("./chat");
Object.defineProperty(exports, "chatGroupRoutes", { enumerable: true, get: function () { return chat_1.chatGroupRoutes; } });
var agent_1 = require("./agent");
Object.defineProperty(exports, "agentGroupRoutes", { enumerable: true, get: function () { return agent_1.agentGroupRoutes; } });
var knowledge_1 = require("./knowledge");
Object.defineProperty(exports, "knowledgeGroupRoutes", { enumerable: true, get: function () { return knowledge_1.knowledgeGroupRoutes; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "authGroupRoutes", { enumerable: true, get: function () { return auth_1.authGroupRoutes; } });
var admin_1 = require("./admin");
Object.defineProperty(exports, "adminGroupRoutes", { enumerable: true, get: function () { return admin_1.adminGroupRoutes; } });
exports.routeGroups = [
    {
        name: 'Chat',
        prefix: '/chat',
        router: () => Promise.resolve().then(() => __importStar(require('./chat'))).then(m => m.chatGroupRoutes),
        version: '1.0',
        description: 'Chat and messaging operations'
    },
    {
        name: 'Agent',
        prefix: '/agent',
        router: () => Promise.resolve().then(() => __importStar(require('./agent'))).then(m => m.agentGroupRoutes),
        version: '1.0',
        description: 'AI agent management and execution'
    },
    {
        name: 'Knowledge',
        prefix: '/knowledge',
        router: () => Promise.resolve().then(() => __importStar(require('./knowledge'))).then(m => m.knowledgeGroupRoutes),
        version: '1.0',
        description: 'Knowledge base and document management'
    },
    {
        name: 'Auth',
        prefix: '/auth',
        router: () => Promise.resolve().then(() => __importStar(require('./auth'))).then(m => m.authGroupRoutes),
        version: '1.0',
        description: 'Authentication and authorization'
    },
    {
        name: 'Admin',
        prefix: '/admin',
        router: () => Promise.resolve().then(() => __importStar(require('./admin'))).then(m => m.adminGroupRoutes),
        version: '1.0',
        description: 'Administrative operations'
    }
];
//# sourceMappingURL=index.js.map