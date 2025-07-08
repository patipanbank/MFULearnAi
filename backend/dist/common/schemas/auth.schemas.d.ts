import { z } from 'zod';
export declare const emailSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const passwordSchema: z.ZodString;
export declare const usernameSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
    username: z.ZodEffects<z.ZodString, string, string>;
    firstName: z.ZodEffects<z.ZodString, string, string>;
    lastName: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
}, {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    password: string;
}, {
    token: string;
    password: string;
}>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
