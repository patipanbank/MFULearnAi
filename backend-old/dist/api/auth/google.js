"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongodb_js_1 = require("../../lib/mongodb.js");
const User_js_1 = __importDefault(require("../../models/User.js"));
const router = (0, express_1.Router)();
const googleAuthHandler = async (req, res) => {
    try {
        const { token } = req.body;
        // ตรวจสอบ token กับ Google
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        const allowedDomains = process.env.GOOGLE_ALLOWED_DOMAINS?.split(',') || [];
        // ฟังก์ชันสำหรับตรวจสอบโดเมน
        const isAllowedDomain = (email) => {
            return allowedDomains.some(domain => email.endsWith('@' + domain));
        };
        // ใช้ในการตรวจสอบ
        if (!isAllowedDomain(userData.email)) {
            res.status(401).json({
                message: 'กรุณาใช้อีเมลของมหาวิทยาลัยแม่ฟ้าหลวงในการเข้าสู่ระบบ'
            });
            return;
        }
        // เชื่อมต่อ MongoDB
        await (0, mongodb_js_1.connectDB)();
        // ค้นหาหรือสร้างผู้ใช้ใหม่
        let user = await User_js_1.default.findOne({ email: userData.email });
        if (!user) {
            user = await User_js_1.default.create({
                email: userData.email,
                name: userData.name,
                picture: userData.picture,
                googleId: userData.sub,
            });
        }
        // สร้าง JWT token
        const authToken = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: authToken });
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
router.post('/google', googleAuthHandler);
exports.default = router;
