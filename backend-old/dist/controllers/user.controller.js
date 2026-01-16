"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guestLogin = void 0;
const user_service_1 = require("../services/user.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
/**
 * POST /api/auth/guest - Guest login endpoint
 */
exports.guestLogin = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    if (!body || !body.nameID) {
        throw new errors_1.BadRequestError('nameID is required');
    }
    let user = await (0, user_service_1.getUserbynameID)(body.nameID);
    if (!user) {
        user = await (0, user_service_1.createUser)({ nameID: body.nameID, role: 'Students' });
        if (!user) {
            throw new errors_1.InternalError('Failed to create user');
        }
    }
    const userData = {
        nameID: user.nameID,
        username: user.username || 'guest',
        email: user.email || 'guest@localhost',
        firstName: user.firstName || 'Guest',
        lastName: user.lastName || 'User',
        role: user.role,
        groups: [user.role],
    };
    const token = (0, auth_1.generateToken)(userData, '1h');
    const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');
    const redirectUrl = `/auth-callback?token=${token}&user_data=${encodedUserData}`;
    res.status(200).send(redirectUrl.toString());
});
