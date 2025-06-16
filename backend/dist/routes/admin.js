"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = __importDefault(require("../models/User"));
const roleGuard_1 = require("../middleware/roleGuard");
const SystemPrompt_1 = require("../models/SystemPrompt");
const auto_department_service_1 = require("../services/auto_department_service");
const router = (0, express_1.Router)();
// Get all admin users (SuperAdmin only)
router.get('/all', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const admins = await User_1.default.find({ role: 'Admin' })
            .select('-password') // Exclude password from the response
            .sort({ created: -1 });
        res.status(200).json(admins);
    }
    catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: 'Error fetching admins' });
    }
});
// อ่าน system prompt - Define this BEFORE the /:id route to prevent conflicts
router.get('/system-prompt', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        // ดึง system prompt ล่าสุด
        let systemPrompt = await SystemPrompt_1.SystemPrompt.findOne().sort({ updatedAt: -1 });
        // ถ้าไม่มี prompt ในระบบ ให้สร้างค่าเริ่มต้น
        if (!systemPrompt) {
            const user = req.user;
            systemPrompt = await SystemPrompt_1.SystemPrompt.create({
                prompt: 'You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.\n\nResponse Style 🎯:\n- Be concise, friendly and conversational\n- Always respond in the same language the user is using\n- Use appropriate emojis to make responses engaging\n- Never say "I don\'t know" or "I\'m not sure"\n- Always provide answers using your knowledge and reasoning\n- Break down complex topics into clear steps\n- Use markdown formatting effectively\n\nKnowledge Approach 📚:\n- Use provided context first, then general knowledge\n- Can analyze images, read files, search web\n- Provide step-by-step solutions for issues\n- Cite sources when referencing specific information\n- For MFU questions without specific data, provide helpful general information\n\nRemember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.',
                updatedBy: user.username
            });
        }
        res.json(systemPrompt);
    }
    catch (error) {
        console.error('Error getting system prompt:', error);
        res.status(500).json({ error: 'Failed to retrieve system prompt' });
    }
});
// แก้ไข system prompt - Define this BEFORE the /:id route to prevent conflicts
router.put('/system-prompt', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Invalid prompt format' });
            return;
        }
        const user = req.user;
        const systemPrompt = await SystemPrompt_1.SystemPrompt.create({
            prompt,
            updatedBy: user.username
        });
        res.json(systemPrompt);
    }
    catch (error) {
        console.error('Error updating system prompt:', error);
        res.status(500).json({ error: 'Failed to update system prompt' });
    }
});
// Get specific admin by ID (SuperAdmin only)
router.get('/:id', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const admin = await User_1.default.findOne({ _id: req.params.id, role: 'Admin' })
            .select('-password'); // Exclude password from the response
        if (!admin) {
            res.status(404).json({ message: 'Admin not found' });
            return;
        }
        res.status(200).json(admin);
    }
    catch (error) {
        console.error('Error fetching admin:', error);
        res.status(500).json({ message: 'Error fetching admin' });
    }
});
// Update admin information (SuperAdmin only)
router.put('/:id', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const { username, password, firstName, lastName, email, department } = req.body;
        const adminId = req.params.id;
        // Find the admin user first
        const admin = await User_1.default.findOne({ _id: adminId, role: 'Admin' });
        if (!admin) {
            res.status(404).json({ message: 'Admin not found' });
            return;
        }
        // If username is provided and different from current, check for duplicates
        if (username && username !== admin.username) {
            const existingUser = await User_1.default.findOne({ username });
            if (existingUser) {
                res.status(400).json({ message: 'This username already exists' });
                return;
            }
            admin.username = username;
            admin.nameID = username; // Also update nameID to match username
        }
        // Update password if provided
        if (password) {
            const hashedPassword = await bcrypt_1.default.hash(password, 10);
            admin.password = hashedPassword;
        }
        // Ensure department exists if provided
        if (department) {
            await (0, auto_department_service_1.ensureDepartmentExists)(department);
        }
        // Update other fields if provided
        if (firstName)
            admin.firstName = firstName;
        if (lastName)
            admin.lastName = lastName;
        if (email)
            admin.email = email;
        if (department)
            admin.department = department;
        // Save the updated admin
        await admin.save();
        // Return the updated admin without the password
        const adminData = {
            _id: admin._id,
            username: admin.username,
            nameID: admin.nameID,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            department: admin.department,
            role: admin.role
        };
        res.status(200).json({
            message: 'Admin updated successfully',
            admin: adminData
        });
    }
    catch (error) {
        console.error('Error updating admin:', error);
        res.status(500).json({ message: 'Error updating admin' });
    }
});
// Delete admin (SuperAdmin only)
router.delete('/:id', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const admin = await User_1.default.findOneAndDelete({ _id: req.params.id, role: 'Admin' });
        if (!admin) {
            res.status(404).json({ message: 'Admin not found' });
            return;
        }
        res.status(200).json({ message: 'Admin deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Error deleting admin' });
    }
});
router.post('/create', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const { username, password, firstName, lastName, email, department } = req.body;
        // ตรวจสอบข้อมูลที่จำเป็น
        if (!username || !password || !firstName || !lastName || !email || !department) {
            res.status(400).json({ message: 'Please fill in all required fields' });
            return;
        }
        // ตรวจสอบว่ามี username ซ้ำหรือไม่
        const existingUser = await User_1.default.findOne({ username });
        if (existingUser) {
            res.status(400).json({ message: 'This username already exists' });
            return;
        }
        // Ensure department exists
        await (0, auto_department_service_1.ensureDepartmentExists)(department);
        // เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // สร้าง Admin user ใหม่
        const newAdmin = new User_1.default({
            nameID: username,
            username,
            password: hashedPassword,
            email,
            firstName,
            lastName,
            department,
            role: 'Admin',
            groups: ['Admin']
        });
        await newAdmin.save();
        // ส่งข้อมูลกลับโดยไม่รวมรหัสผ่าน
        const adminData = {
            username: newAdmin.username,
            email: newAdmin.email,
            firstName: newAdmin.firstName,
            lastName: newAdmin.lastName,
            department: newAdmin.department,
            role: newAdmin.role
        };
        res.status(201).json({
            message: 'Admin created successfully',
            admin: adminData
        });
    }
    catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: 'Error creating admin' });
    }
});
exports.default = router;
