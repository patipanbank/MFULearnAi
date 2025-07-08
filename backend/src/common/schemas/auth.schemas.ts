import { z } from 'zod';

// Base validation schemas
export const emailSchema = z
  .string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
  })
  .email({ message: 'Invalid email address' })
  .max(100, 'Email must be less than 100 characters')
  .transform(email => email.toLowerCase().trim());

export const passwordSchema = z
  .string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const usernameSchema = z
  .string({
    required_error: 'Username is required',
    invalid_type_error: 'Username must be a string',
  })
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .transform(username => username.toLowerCase().trim());

// Auth DTO Schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  firstName: z
    .string({
      required_error: 'First name is required',
      invalid_type_error: 'First name must be a string',
    })
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .transform(name => name.trim()),
  lastName: z
    .string({
      required_error: 'Last name is required',
      invalid_type_error: 'Last name must be a string',
    })
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .transform(name => name.trim()),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({
      required_error: 'Refresh token is required',
      invalid_type_error: 'Refresh token must be a string',
    })
    .min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z
    .string({
      required_error: 'Reset token is required',
      invalid_type_error: 'Reset token must be a string',
    })
    .min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({
      required_error: 'Current password is required',
      invalid_type_error: 'Current password must be a string',
    })
    .min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// Type inference
export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>; 