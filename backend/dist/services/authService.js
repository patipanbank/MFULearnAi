"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const samlService_1 = require("./samlService");
const userService_1 = require("./userService");
const jwtService_1 = require("./jwtService");
const user_1 = require("../models/user");
class AuthService {
    async handleSamlLogin(samlProfile) {
        const userProfile = samlService_1.samlService.mapSamlProfile(samlProfile);
        const user = await userService_1.userService.find_or_create_saml_user(userProfile);
        console.log(`👤 User authenticated: ${user.username} (${user.email})`);
        const token = jwtService_1.jwtService.createSamlToken(user);
        return { token, user };
    }
    async handleAdminLogin(username, password) {
        const user = await userService_1.userService.find_admin_by_username(username);
        if (!user || !user.password) {
            throw new Error('User account not found or password not set');
        }
        const isMatch = await userService_1.userService.verify_admin_password(password, user.password);
        if (!isMatch) {
            throw new Error('Password is incorrect');
        }
        const token = jwtService_1.jwtService.createAdminToken(user);
        const userWithoutPassword = { ...user.toObject(), password: undefined };
        return { token, user: new user_1.User(userWithoutPassword) };
    }
    refreshToken(currentUser) {
        return jwtService_1.jwtService.refreshToken(currentUser);
    }
    formatUserResponse(user) {
        return {
            _id: { $oid: user.sub || user._id },
            nameID: user.nameID,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            department: user.department,
            role: user.role,
            groups: user.groups || [],
            tokenQuota: user.tokenQuota || 100000,
            dailyTokenLimit: user.dailyTokenLimit || 50000,
            created: user.created || new Date(),
            updated: user.updated || new Date()
        };
    }
}
exports.authService = new AuthService();
//# sourceMappingURL=authService.js.map