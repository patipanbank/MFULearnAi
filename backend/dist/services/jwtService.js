"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
class JwtService {
    createSamlToken(user) {
        const payload = {
            sub: user._id.toString(),
            nameID: user.nameID,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            department: user.department,
            groups: user.groups,
            role: user.role,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        };
        return jsonwebtoken_1.default.sign(payload, config_1.default.JWT_SECRET, {
            algorithm: config_1.default.JWT_ALGORITHM
        });
    }
    createAdminToken(user) {
        const payload = {
            sub: user._id.toString(),
            nameID: user.nameID,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            department: user.department,
            groups: user.groups,
            role: user.role,
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        };
        return jsonwebtoken_1.default.sign(payload, config_1.default.JWT_SECRET, {
            algorithm: config_1.default.JWT_ALGORITHM
        });
    }
    refreshToken(currentPayload) {
        const newPayload = {
            sub: currentPayload.sub,
            nameID: currentPayload.nameID,
            username: currentPayload.username,
            email: currentPayload.email,
            firstName: currentPayload.firstName,
            lastName: currentPayload.lastName,
            department: currentPayload.department,
            groups: currentPayload.groups,
            role: currentPayload.role,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        };
        return jsonwebtoken_1.default.sign(newPayload, config_1.default.JWT_SECRET, {
            algorithm: config_1.default.JWT_ALGORITHM
        });
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
    }
}
exports.jwtService = new JwtService();
//# sourceMappingURL=jwtService.js.map