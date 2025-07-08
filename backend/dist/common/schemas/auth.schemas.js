"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.refreshTokenSchema = exports.registerSchema = exports.loginSchema = exports.usernameSchema = exports.passwordSchema = exports.emailSchema = void 0;
const zod_1 = require("zod");
exports.emailSchema = zod_1.z
    .string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
})
    .email({ message: 'Invalid email address' })
    .max(100, 'Email must be less than 100 characters')
    .transform(email => email.toLowerCase().trim());
exports.passwordSchema = zod_1.z
    .string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
})
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');
exports.usernameSchema = zod_1.z
    .string({
    required_error: 'Username is required',
    invalid_type_error: 'Username must be a string',
})
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .transform(username => username.toLowerCase().trim());
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Username is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.registerSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    username: exports.usernameSchema,
    firstName: zod_1.z
        .string({
        required_error: 'First name is required',
        invalid_type_error: 'First name must be a string',
    })
        .min(1, 'First name is required')
        .max(50, 'First name must be less than 50 characters')
        .transform(name => name.trim()),
    lastName: zod_1.z
        .string({
        required_error: 'Last name is required',
        invalid_type_error: 'Last name must be a string',
    })
        .min(1, 'Last name is required')
        .max(50, 'Last name must be less than 50 characters')
        .transform(name => name.trim()),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z
        .string({
        required_error: 'Refresh token is required',
        invalid_type_error: 'Refresh token must be a string',
    })
        .min(1, 'Refresh token is required'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: exports.emailSchema,
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z
        .string({
        required_error: 'Reset token is required',
        invalid_type_error: 'Reset token must be a string',
    })
        .min(1, 'Reset token is required'),
    password: exports.passwordSchema,
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z
        .string({
        required_error: 'Current password is required',
        invalid_type_error: 'Current password must be a string',
    })
        .min(1, 'Current password is required'),
    newPassword: exports.passwordSchema,
});
//# sourceMappingURL=auth.schemas.js.map