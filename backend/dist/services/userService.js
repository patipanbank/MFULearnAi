"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const mongodb_1 = require("../lib/mongodb");
const user_1 = require("../models/user");
const security_1 = require("../utils/security");
const departmentService_1 = require("./departmentService");
const mongoose_1 = __importDefault(require("mongoose"));
class UserService {
    async get_user_by_id(user_id) {
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const user = await db.collection('users').findOne({ _id: new mongoose_1.default.Types.ObjectId(user_id) });
        if (user && user._id) {
            user._id = user._id.toString();
        }
        return user ? new user_1.User(user) : null;
    }
    async get_all_admins() {
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const admins = await db.collection('users')
            .find({ role: user_1.UserRole.ADMIN })
            .sort({ created: -1 })
            .toArray();
        for (const admin of admins) {
            if (admin._id) {
                admin._id = admin._id.toString();
            }
        }
        return admins.map(admin => new user_1.User(admin));
    }
    async find_admin_by_username(username) {
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const user = await db.collection('users').findOne({
            username,
            role: { $in: [user_1.UserRole.ADMIN, user_1.UserRole.SUPER_ADMIN] }
        });
        if (user && user._id) {
            user._id = user._id.toString();
        }
        return user ? new user_1.User(user) : null;
    }
    async verify_admin_password(password, hashed_password) {
        return (0, security_1.verify_password)(password, hashed_password);
    }
    async find_or_create_saml_user(profile) {
        const db = (0, mongodb_1.getDatabase)();
        if (!db)
            throw new Error('Database not connected');
        const username = profile.username;
        if (!username) {
            throw new Error('Username is required from SAML profile');
        }
        const department_name = profile.department?.toLowerCase() || '';
        if (department_name) {
            await (0, departmentService_1.ensure_department_exists)(department_name);
        }
        let groups = profile.groups || [];
        if (!Array.isArray(groups)) {
            groups = [groups];
        }
        const map_group_to_role = (user_groups) => {
            console.log(`🔍 Role mapping - Input groups: ${JSON.stringify(user_groups)}`);
            const is_student = user_groups.some(g => g === 'S-1-5-21-893890582-1041674030-1199480097-43779');
            const role = is_student ? user_1.UserRole.STUDENTS : user_1.UserRole.STAFFS;
            console.log(`🔍 Role mapping - is_student: ${is_student}, result: ${role}`);
            return role;
        };
        const user_data_to_update = {
            nameID: profile.nameID,
            username,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            department: department_name,
            groups,
            role: map_group_to_role(groups),
            updated: new Date()
        };
        const clean_data = Object.fromEntries(Object.entries(user_data_to_update).filter(([_, v]) => v !== undefined));
        const result = await db.collection('users').findOneAndUpdate({ username }, {
            $set: clean_data,
            $setOnInsert: { created: new Date() }
        }, { upsert: true, returnDocument: 'after' });
        if (result && result._id) {
            result._id = result._id.toString();
        }
        return new user_1.User(result);
    }
}
exports.userService = new UserService();
//# sourceMappingURL=userService.js.map