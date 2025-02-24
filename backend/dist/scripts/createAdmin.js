"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("../lib/mongodb");
const User_1 = __importDefault(require("../models/User"));
const bcrypt_1 = __importDefault(require("bcrypt"));
async function createAdminUser() {
    try {
        await (0, mongodb_1.connectDB)();
        const hashedPassword = await bcrypt_1.default.hash('admin123', 10);
        const adminUser = new User_1.default({
            username: 'admin',
            password: hashedPassword,
            isAdmin: true,
            groups: ['Admin'],
            email: 'admin@mfu.ac.th',
            firstName: 'Admin',
            lastName: 'User',
            nameID: 'admin',
            role: 'Admin'
        });
        await adminUser.save();
        console.log('Admin user created successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
}
createAdminUser();
