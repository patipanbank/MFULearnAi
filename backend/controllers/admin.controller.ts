import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { SystemPrompt } from '../models/SystemPrompt';
import { ensureDepartmentExists } from '../services/autoDepartment.service';
import { AuthenticatedRequest } from '../types/common';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  BadRequestError, 
  NotFoundError, 
  ConflictError 
} from '../errors';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>) => 
  asyncHandler<AuthenticatedRequest>(fn);

/**
 * GET /api/admin/all - Get all admin users (SuperAdmin only)
 */
export const getAllAdmins = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const admins = await User.find({ role: 'Admin' })
    .select('-password')
    .sort({ created: -1 });

  res.status(200).json(admins);
});

/**
 * GET /api/admin/users - Get all users (SuperAdmin only)
 */
export const getAllUsers = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const users = await User.find({})
    .select('username nameID email firstName lastName department role groups created updated')
    .sort({ created: -1 })
    .lean();

  res.status(200).json(users);
});

/**
 * PUT /api/admin/users/:id - Update any user (SuperAdmin only)
 */
export const updateUser = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { username, email, firstName, lastName, department, role, groups } = req.body;

  const updateData: Record<string, any> = { updated: new Date() };
  
  if (username !== undefined) updateData.username = username;
  if (email !== undefined) updateData.email = email;
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (department !== undefined) updateData.department = department;
  if (groups !== undefined) updateData.groups = groups;

  if (role !== undefined) {
    if (role === 'SuperAdmin') {
      throw new BadRequestError('Cannot set role to SuperAdmin via this endpoint');
    }
    updateData.role = role;
  }

  // Check for duplicate username
  if (username) {
    const existingUser = await User.findOne({ username, _id: { $ne: id } });
    if (existingUser) {
      throw new ConflictError('This username already exists');
    }
  }

  const updatedUser = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    select: 'username nameID email firstName lastName department role groups created updated',
  });

  if (!updatedUser) {
    throw new NotFoundError('User not found');
  }

  res.status(200).json({
    message: 'User updated successfully',
    user: updatedUser,
  });
});

/**
 * GET /api/admin/system-prompt - Get system prompt (SuperAdmin only)
 */
export const getSystemPrompt = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  let systemPrompt = await SystemPrompt.findOne().sort({ updatedAt: -1 });

  if (!systemPrompt) {
    const user = req.user;
    systemPrompt = await SystemPrompt.create({
      prompt: getDefaultSystemPrompt(),
      updatedBy: user.username,
    });
  }

  res.json(systemPrompt);
});

/**
 * PUT /api/admin/system-prompt - Update system prompt (SuperAdmin only)
 */
export const updateSystemPrompt = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    throw new BadRequestError('Invalid prompt format');
  }

  const user = req.user;
  const systemPrompt = await SystemPrompt.create({
    prompt,
    updatedBy: user.username,
  });

  res.json(systemPrompt);
});

/**
 * GET /api/admin/:id - Get specific admin by ID (SuperAdmin only)
 */
export const getAdmin = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const admin = await User.findOne({ _id: req.params.id, role: 'Admin' })
    .select('-password');

  if (!admin) {
    throw new NotFoundError('Admin not found');
  }

  res.status(200).json(admin);
});

/**
 * PUT /api/admin/:id - Update admin (SuperAdmin only)
 */
export const updateAdmin = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { username, password, firstName, lastName, email, department } = req.body;
  const adminId = req.params.id;

  const admin = await User.findOne({ _id: adminId, role: 'Admin' });
  if (!admin) {
    throw new NotFoundError('Admin not found');
  }

  // Check for duplicate username
  if (username && username !== admin.username) {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new ConflictError('This username already exists');
    }
    admin.username = username;
    admin.nameID = username;
  }

  // Update password if provided
  if (password) {
    admin.password = await bcrypt.hash(password, 10);
  }

  // Ensure department exists
  if (department) {
    await ensureDepartmentExists(department);
    admin.department = department;
  }

  if (firstName) admin.firstName = firstName;
  if (lastName) admin.lastName = lastName;
  if (email) admin.email = email;

  await admin.save();

  res.status(200).json({
    message: 'Admin updated successfully',
    admin: {
      _id: admin._id,
      username: admin.username,
      nameID: admin.nameID,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      department: admin.department,
      role: admin.role,
    },
  });
});

/**
 * DELETE /api/admin/:id - Delete admin (SuperAdmin only)
 */
export const deleteAdmin = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const admin = await User.findOneAndDelete({ 
    _id: req.params.id, 
    role: 'Admin' 
  });

  if (!admin) {
    throw new NotFoundError('Admin not found');
  }

  res.status(200).json({ message: 'Admin deleted successfully' });
});

/**
 * POST /api/admin/create - Create new admin (SuperAdmin only)
 */
export const createAdmin = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { username, password, firstName, lastName, email, department } = req.body;

  // Validate required fields
  if (!username || !password || !firstName || !lastName || !email || !department) {
    throw new BadRequestError('Please fill in all required fields');
  }

  // Check for duplicate username
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    throw new ConflictError('This username already exists');
  }

  // Ensure department exists
  await ensureDepartmentExists(department);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create admin user
  const newAdmin = new User({
    nameID: username,
    username,
    password: hashedPassword,
    email,
    firstName,
    lastName,
    department,
    role: 'Admin',
    groups: ['Admin'],
  });

  await newAdmin.save();

  res.status(201).json({
    message: 'Admin created successfully',
    admin: {
      username: newAdmin.username,
      email: newAdmin.email,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      department: newAdmin.department,
      role: newAdmin.role,
    },
  });
});

/**
 * Default system prompt
 */
function getDefaultSystemPrompt(): string {
  return `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

Response Style 🎯:
- Be concise, friendly and conversational
- Always respond in the same language the user is using
- Use appropriate emojis to make responses engaging
- Never say "I don't know" or "I'm not sure"
- Always provide answers using your knowledge and reasoning
- Break down complex topics into clear steps
- Use markdown formatting effectively

Knowledge Approach 📚:
- Use provided context first, then general knowledge
- Can analyze images, read files, search web
- Provide step-by-step solutions for issues
- Cite sources when referencing specific information
- For MFU questions without specific data, provide helpful general information

Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.`;
}
