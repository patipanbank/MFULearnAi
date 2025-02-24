"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserById = exports.updateUserBynameID = exports.updateUserById = exports.getUserById = exports.getUserbynameID = exports.createUser = void 0;
const User_1 = __importDefault(require("../models/User"));
// Create a new user
const createUser = async (params) => {
    try {
        const user = new User_1.default({
            nameID: params.nameID,
            username: params.username || 'guest',
            email: params.email || 'guest@localhost',
            firstName: params.firstName || 'Guest',
            lastName: params.lastName || 'User',
            role: params.role,
            groups: params.groups || []
        });
        return await user.save();
    }
    catch (error) {
        console.error('Error creating user:', error);
        return null;
    }
};
exports.createUser = createUser;
const getUserbynameID = async (nameID) => {
    try {
        return await User_1.default.findOne({ nameID });
    }
    catch (error) {
        console.error('Error finding user:', error);
        return null;
    }
};
exports.getUserbynameID = getUserbynameID;
// Read a user by ID
const getUserById = async (id) => {
    try {
        const user = await User_1.default.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }
    catch (error) {
        throw new Error(`Error fetching user: ${error.message}`);
    }
};
exports.getUserById = getUserById;
// Update a user by ID
const updateUserById = async (id, updateData) => {
    try {
        const user = await User_1.default.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }
    catch (error) {
        throw new Error(`Error updating user: ${error.message}`);
    }
};
exports.updateUserById = updateUserById;
const updateUserBynameID = async (nameID, updateData) => {
    try {
        const user = await User_1.default.findOne({ nameID });
        if (!user) {
            throw new Error('User not found');
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
        throw new Error(`Error updating user: ${error.message}`);
    }
};
exports.updateUserBynameID = updateUserBynameID;
// Delete a user by ID
const deleteUserById = async (id) => {
    try {
        const user = await User_1.default.findByIdAndDelete(id);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }
    catch (error) {
        throw new Error(`Error deleting user: ${error.message}`);
    }
};
exports.deleteUserById = deleteUserById;
