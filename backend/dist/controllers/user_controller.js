"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guest_login = void 0;
const user_service_1 = require("../services/user_service");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const guest_login = async (req, res) => {
    try {
        const body = await req.body;
        if (!body) {
            res.status(400).json({ message: 'nameID is required' });
            return;
        }
        let user = await (0, user_service_1.getUserbynameID)(body.nameID);
        if (!user) {
            user = await (0, user_service_1.createUser)({ nameID: body.nameID, role: 'Students' });
            if (!user) {
                res.status(500).json({ message: 'Failed to create user' });
                return;
            }
        }
        const userData = {
            nameID: user.nameID,
            username: user.username || 'guest',
            email: user.email || 'guest@localhost',
            firstName: user.firstName || 'Guest',
            lastName: user.lastName || 'User',
            role: user.role,
            groups: [user.role]
        };
        const token = jsonwebtoken_1.default.sign({
            nameID: userData.nameID,
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            groups: userData.groups
        }, config_1.JWT_SECRET, { expiresIn: '1h' });
        const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');
        const redirectUrl = `/auth-callback?token=${token}&user_data=${encodedUserData}`;
        res.status(200).send(redirectUrl.toString());
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.guest_login = guest_login;
