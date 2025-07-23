"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeObjectId = exports.sanitizeUrl = exports.sanitizeEmail = exports.sanitizeAgents = exports.sanitizeAgent = exports.sanitizeText = exports.sanitizeHtml = void 0;
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const sanitizeHtml = (html) => {
    return isomorphic_dompurify_1.default.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target']
    });
};
exports.sanitizeHtml = sanitizeHtml;
const sanitizeText = (text) => {
    if (!text)
        return '';
    return text
        .trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .substring(0, 10000);
};
exports.sanitizeText = sanitizeText;
const sanitizeAgent = (agent) => {
    if (!agent)
        return null;
    const obj = agent.toObject ? agent.toObject() : agent;
    return {
        ...obj,
        name: (0, exports.sanitizeText)(obj.name || ''),
        description: (0, exports.sanitizeText)(obj.description || ''),
        systemPrompt: (0, exports.sanitizeText)(obj.systemPrompt || ''),
        modelId: (0, exports.sanitizeText)(obj.modelId || ''),
        tags: Array.isArray(obj.tags) ? obj.tags.map(exports.sanitizeText) : [],
        collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames.map(exports.sanitizeText) : [],
        tools: Array.isArray(obj.tools) ? obj.tools.map((tool) => ({
            ...tool,
            name: (0, exports.sanitizeText)(tool.name || ''),
            description: (0, exports.sanitizeText)(tool.description || '')
        })) : []
    };
};
exports.sanitizeAgent = sanitizeAgent;
const sanitizeAgents = (agents) => {
    if (!Array.isArray(agents))
        return [];
    return agents.map(exports.sanitizeAgent).filter(Boolean);
};
exports.sanitizeAgents = sanitizeAgents;
const sanitizeEmail = (email) => {
    if (!email)
        return null;
    const sanitized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : null;
};
exports.sanitizeEmail = sanitizeEmail;
const sanitizeUrl = (url) => {
    if (!url)
        return null;
    try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return null;
        }
        return urlObj.toString();
    }
    catch {
        return null;
    }
};
exports.sanitizeUrl = sanitizeUrl;
const sanitizeObjectId = (id) => {
    if (!id || typeof id !== 'string')
        return null;
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id) ? id : null;
};
exports.sanitizeObjectId = sanitizeObjectId;
//# sourceMappingURL=sanitize.js.map