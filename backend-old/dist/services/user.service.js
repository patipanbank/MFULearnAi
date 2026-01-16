"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserbynameID = void 0;
exports.createUser = createUser;
exports.getUserByNameID = getUserByNameID;
exports.getUserById = getUserById;
exports.updateUserById = updateUserById;
exports.updateUserByNameID = updateUserByNameID;
exports.deleteUserById = deleteUserById;
const User_1 = __importDefault(require("../models/User"));
const errors_1 = require("../errors");
/**
 * Create a new user
 */
async function createUser(params) {
    try {
        const user = new User_1.default({
            nameID: params.nameID,
            username: params.username || 'guest',
            email: params.email || 'guest@localhost',
            firstName: params.firstName || 'Guest',
            lastName: params.lastName || 'User',
            role: params.role,
            groups: params.groups || [],
        });
        return await user.save();
    }
    catch (error) {
        console.error('Error creating user:', error);
        if (error instanceof Error && error.message.includes('duplicate')) {
            throw new errors_1.ConflictError('User already exists');
        }
        throw new errors_1.InternalError('Failed to create user');
    }
}
/**
 * Get user by nameID
 */
async function getUserByNameID(nameID) {
    try {
        const user = await User_1.default.findOne({ nameID });
        return user;
    }
    catch (error) {
        console.error('Error finding user:', error);
        throw new errors_1.InternalError('Failed to find user');
    }
}
/**
 * Get user by ID
 */
async function getUserById(id) {
    try {
        const user = await User_1.default.findById(id);
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        return user;
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            throw error;
        }
        throw new errors_1.InternalError(`Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Update user by ID
 */
async function updateUserById(id, updateData) {
    try {
        const user = await User_1.default.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        return user;
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            throw error;
        }
        throw new errors_1.InternalError(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Update user by nameID
 */
async function updateUserByNameID(nameID, updateData) {
    try {
        const user = await User_1.default.findOne({ nameID });
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        if (updateData.username)
            user.username = updateData.username;
        if (updateData.email)
            user.email = updateData.email;
        if (updateData.firstName)
            user.firstName = updateData.firstName;
        if (updateData.lastName)
            user.lastName = updateData.lastName;
        if (updateData.groups)
            user.groups = updateData.groups;
        if (updateData.role)
            user.role = updateData.role;
        user.updated = new Date();
        await user.save();
        return user;
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            throw error;
        }
        throw new errors_1.InternalError(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Delete user by ID
 */
async function deleteUserById(id) {
    try {
        const user = await User_1.default.findByIdAndDelete(id);
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        return user;
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            throw error;
        }
        throw new errors_1.InternalError(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
// Legacy exports for backward compatibility
exports.getUserbynameID = getUserByNameID;
