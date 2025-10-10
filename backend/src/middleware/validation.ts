import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

export const validateLoginInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ValidationError('Email and password are required'));
  }

  if (!validateEmail(email)) {
    return next(new ValidationError('Invalid email format'));
  }

  next();
};

export const validateRegisterInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    return next(new ValidationError('Email, password, and display name are required'));
  }

  if (!validateEmail(email)) {
    return next(new ValidationError('Invalid email format'));
  }

  if (!validatePassword(password)) {
    return next(new ValidationError('Password must be at least 8 characters long'));
  }

  if (displayName.trim().length < 2) {
    return next(new ValidationError('Display name must be at least 2 characters long'));
  }

  next();
};

export const validateChatInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return next(new ValidationError('Message is required and must be a string'));
  }

  if (message.trim().length === 0) {
    return next(new ValidationError('Message cannot be empty'));
  }

  if (message.length > 10000) {
    return next(new ValidationError('Message is too long (max 10000 characters)'));
  }

  next();
};

export default {
  validateEmail,
  validatePassword,
  validateLoginInput,
  validateRegisterInput,
  validateChatInput,
};
