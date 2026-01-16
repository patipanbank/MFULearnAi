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
        const hashedPassword = await bcrypt_1.default.hash('superadmin123', 10);
        const adminUser = new User_1.default({
            username: 'superadmin',
            password: hashedPassword,
            isAdmin: true,
            groups: ['SuperAdmin'],
            email: 'superadmin@mfu.ac.th',
            firstName: 'Super',
            lastName: 'Admin',
            nameID: 'superadmin',
            role: 'SuperAdmin'
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
