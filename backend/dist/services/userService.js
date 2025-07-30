"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const mongodb_1 = require("../lib/mongodb");
const user_1 = require("../models/user");
class UserService {
    constructor() {
        this.db = (0, mongodb_1.getConnection)();
        console.log('✅ User service initialized');
    }
    async getAllUsers() {
        try {
            return await user_1.User.find().sort({ createdAt: -1 }).exec();
        }
        catch (error) {
            console.error('❌ Error getting users:', error);
            return [];
        }
    }
    async getUserById(id) {
        try {
            return await user_1.User.findById(id).exec();
        }
        catch (error) {
            console.error('❌ Error getting user:', error);
            return null;
        }
    }
    async getUserByEmail(email) {
        try {
            return await user_1.User.findOne({ email }).exec();
        }
        catch (error) {
            console.error('❌ Error getting user by email:', error);
            return null;
        }
    }
    async createUser(userData) {
        try {
            const user = new user_1.User(userData);
            await user.save();
            return user;
        }
        catch (error) {
            console.error('❌ Error creating user:', error);
            return null;
        }
    }
    async updateUser(id, updateData) {
        try {
            return await user_1.User.findByIdAndUpdate(id, updateData, { new: true }).exec();
        }
        catch (error) {
            console.error('❌ Error updating user:', error);
            return null;
        }
    }
    async deleteUser(id) {
        try {
            const result = await user_1.User.findByIdAndDelete(id).exec();
            return !!result;
        }
        catch (error) {
            console.error('❌ Error deleting user:', error);
            return false;
        }
    }
    async getAdmins() {
        try {
            const admins = await user_1.User.find({ role: { $in: ['admin', 'superadmin'] } }).exec();
            return admins;
        }
        catch (error) {
            console.error('❌ Error getting admins:', error);
            return [];
        }
    }
    async getUserStats() {
        try {
            const totalUsers = await user_1.User.countDocuments();
            const activeUsers = await user_1.User.countDocuments({ isActive: true });
            const adminUsers = await user_1.User.countDocuments({ role: { $in: ['admin', 'superadmin'] } });
            return {
                total: totalUsers,
                active: activeUsers,
                admins: adminUsers
            };
        }
        catch (error) {
            console.error('❌ Error getting user stats:', error);
            return { total: 0, active: 0, admins: 0 };
        }
    }
    async find_or_create_saml_user(userProfile) {
        try {
            let user = await user_1.User.findOne({
                $or: [
                    { nameID: userProfile.nameID },
                    { email: userProfile.email }
                ]
            });
            if (!user) {
                user = new user_1.User({
                    nameID: userProfile.nameID,
                    username: userProfile.username,
                    email: userProfile.email,
                    firstName: userProfile.firstName,
                    lastName: userProfile.lastName,
                    department: userProfile.department,
                    groups: userProfile.groups || [],
                    role: 'user',
                    isActive: true,
                    lastLogin: new Date()
                });
                await user.save();
                console.log(`✅ Created new SAML user: ${user.username}`);
            }
            else {
                user.nameID = userProfile.nameID;
                user.username = userProfile.username;
                user.email = userProfile.email;
                user.firstName = userProfile.firstName;
                user.lastName = userProfile.lastName;
                user.department = userProfile.department;
                user.groups = userProfile.groups || [];
                user.lastLogin = new Date();
                await user.save();
                console.log(`✅ Updated existing SAML user: ${user.username}`);
            }
            return user;
        }
        catch (error) {
            console.error('❌ Error in findOrCreateSamlUser:', error);
            throw error;
        }
    }
    async find_admin_by_username(username) {
        try {
            return await user_1.User.findOne({
                username,
                role: { $in: ['admin', 'superadmin'] }
            });
        }
        catch (error) {
            console.error('❌ Error finding admin by username:', error);
            return null;
        }
    }
    async verify_admin_password(password, hashedPassword) {
        try {
            return hashedPassword === password;
        }
        catch (error) {
            console.error('❌ Error verifying admin password:', error);
            return false;
        }
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=userService.js.map