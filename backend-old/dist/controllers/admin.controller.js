"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdmin = exports.deleteAdmin = exports.updateAdmin = exports.getAdmin = exports.updateSystemPrompt = exports.getSystemPrompt = exports.updateUser = exports.getAllUsers = exports.getAllAdmins = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = __importDefault(require("../models/User"));
const SystemPrompt_1 = require("../models/SystemPrompt");
const autoDepartment_service_1 = require("../services/autoDepartment.service");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
/**
 * GET /api/admin/all - Get all admin users (SuperAdmin only)
 */
exports.getAllAdmins = authHandler(async (req, res) => {
    const admins = await User_1.default.find({ role: 'Admin' })
        .select('-password')
        .sort({ created: -1 });
    res.status(200).json(admins);
});
/**
 * GET /api/admin/users - Get all users (SuperAdmin only)
 */
exports.getAllUsers = authHandler(async (req, res) => {
    const users = await User_1.default.find({})
        .select('username nameID email firstName lastName department role groups created updated')
        .sort({ created: -1 })
        .lean();
    res.status(200).json(users);
});
/**
 * PUT /api/admin/users/:id - Update any user (SuperAdmin only)
 */
exports.updateUser = authHandler(async (req, res) => {
    const { id } = req.params;
    const { username, email, firstName, lastName, department, role, groups } = req.body;
    const updateData = { updated: new Date() };
    if (username !== undefined)
        updateData.username = username;
    if (email !== undefined)
        updateData.email = email;
    if (firstName !== undefined)
        updateData.firstName = firstName;
    if (lastName !== undefined)
        updateData.lastName = lastName;
    if (department !== undefined)
        updateData.department = department;
    if (groups !== undefined)
        updateData.groups = groups;
    if (role !== undefined) {
        if (role === 'SuperAdmin') {
            throw new errors_1.BadRequestError('Cannot set role to SuperAdmin via this endpoint');
        }
        updateData.role = role;
    }
    // Check for duplicate username
    if (username) {
        const existingUser = await User_1.default.findOne({ username, _id: { $ne: id } });
        if (existingUser) {
            throw new errors_1.ConflictError('This username already exists');
        }
    }
    const updatedUser = await User_1.default.findByIdAndUpdate(id, updateData, {
        new: true,
        select: 'username nameID email firstName lastName department role groups created updated',
    });
    if (!updatedUser) {
        throw new errors_1.NotFoundError('User not found');
    }
    res.status(200).json({
        message: 'User updated successfully',
        user: updatedUser,
    });
});
/**
 * GET /api/admin/system-prompt - Get system prompt (SuperAdmin only)
 */
exports.getSystemPrompt = authHandler(async (req, res) => {
    let systemPrompt = await SystemPrompt_1.SystemPrompt.findOne().sort({ updatedAt: -1 });
    if (!systemPrompt) {
        const user = req.user;
        systemPrompt = await SystemPrompt_1.SystemPrompt.create({
            prompt: getDefaultSystemPrompt(),
            updatedBy: user.username,
        });
    }
    res.json(systemPrompt);
});
/**
 * PUT /api/admin/system-prompt - Update system prompt (SuperAdmin only)
 */
exports.updateSystemPrompt = authHandler(async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        throw new errors_1.BadRequestError('Invalid prompt format');
    }
    const user = req.user;
    const systemPrompt = await SystemPrompt_1.SystemPrompt.create({
        prompt,
        updatedBy: user.username,
    });
    res.json(systemPrompt);
});
/**
 * GET /api/admin/:id - Get specific admin by ID (SuperAdmin only)
 */
exports.getAdmin = authHandler(async (req, res) => {
    const admin = await User_1.default.findOne({ _id: req.params.id, role: 'Admin' })
        .select('-password');
    if (!admin) {
        throw new errors_1.NotFoundError('Admin not found');
    }
    res.status(200).json(admin);
});
/**
 * PUT /api/admin/:id - Update admin (SuperAdmin only)
 */
exports.updateAdmin = authHandler(async (req, res) => {
    const { username, password, firstName, lastName, email, department } = req.body;
    const adminId = req.params.id;
    const admin = await User_1.default.findOne({ _id: adminId, role: 'Admin' });
    if (!admin) {
        throw new errors_1.NotFoundError('Admin not found');
    }
    // Check for duplicate username
    if (username && username !== admin.username) {
        const existingUser = await User_1.default.findOne({ username });
        if (existingUser) {
            throw new errors_1.ConflictError('This username already exists');
        }
        admin.username = username;
        admin.nameID = username;
    }
    // Update password if provided
    if (password) {
        admin.password = await bcrypt_1.default.hash(password, 10);
    }
    // Ensure department exists
    if (department) {
        await (0, autoDepartment_service_1.ensureDepartmentExists)(department);
        admin.department = department;
    }
    if (firstName)
        admin.firstName = firstName;
    if (lastName)
        admin.lastName = lastName;
    if (email)
        admin.email = email;
    await admin.save();
    res.status(200).json({
        message: 'Admin updated successfully',
        admin: {
            _id: admin._id,
            username: admin.username,
            nameID: admin.nameID,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            department: admin.department,
            role: admin.role,
        },
    });
});
/**
 * DELETE /api/admin/:id - Delete admin (SuperAdmin only)
 */
exports.deleteAdmin = authHandler(async (req, res) => {
    const admin = await User_1.default.findOneAndDelete({
        _id: req.params.id,
        role: 'Admin'
    });
    if (!admin) {
        throw new errors_1.NotFoundError('Admin not found');
    }
    res.status(200).json({ message: 'Admin deleted successfully' });
});
/**
 * POST /api/admin/create - Create new admin (SuperAdmin only)
 */
exports.createAdmin = authHandler(async (req, res) => {
    const { username, password, firstName, lastName, email, department } = req.body;
    // Validate required fields
    if (!username || !password || !firstName || !lastName || !email || !department) {
        throw new errors_1.BadRequestError('Please fill in all required fields');
    }
    // Check for duplicate username
    const existingUser = await User_1.default.findOne({ username });
    if (existingUser) {
        throw new errors_1.ConflictError('This username already exists');
    }
    // Ensure department exists
    await (0, autoDepartment_service_1.ensureDepartmentExists)(department);
    // Hash password
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    // Create admin user
    const newAdmin = new User_1.default({
        nameID: username,
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        department,
        role: 'Admin',
        groups: ['Admin'],
    });
    await newAdmin.save();
    res.status(201).json({
        message: 'Admin created successfully',
        admin: {
            username: newAdmin.username,
            email: newAdmin.email,
            firstName: newAdmin.firstName,
            lastName: newAdmin.lastName,
            department: newAdmin.department,
            role: newAdmin.role,
        },
    });
});
/**
 * Default system prompt
 */
function getDefaultSystemPrompt() {
    return `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

Response Style 🎯:
- Be concise, friendly and conversational
- Always respond in the same language the user is using
- Use appropriate emojis to make responses engaging
- Never say "I don't know" or "I'm not sure"
- Always provide answers using your knowledge and reasoning
- Break down complex topics into clear steps
- Use markdown formatting effectively

Knowledge Approach 📚:
- Use provided context first, then general knowledge
- Can analyze images, read files, search web
- Provide step-by-step solutions for issues
- Cite sources when referencing specific information
- For MFU questions without specific data, provide helpful general information

Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.`;
}
