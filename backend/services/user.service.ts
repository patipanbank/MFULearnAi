import User, { UserRole } from '../models/User';
import { NotFoundError, ConflictError, InternalError } from '../errors';

export interface CreateUserParams {
  nameID: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  groups?: string[];
}

/**
 * Create a new user
 */
export async function createUser(params: CreateUserParams) {
  try {
    const user = new User({
      nameID: params.nameID,
      username: params.username || 'guest',
      email: params.email || 'guest@localhost',
      firstName: params.firstName || 'Guest',
      lastName: params.lastName || 'User',
      role: params.role,
      groups: params.groups || [],
    });
    return await user.save();
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error && error.message.includes('duplicate')) {
      throw new ConflictError('User already exists');
    }
    throw new InternalError('Failed to create user');
  }
}

/**
 * Get user by nameID
 */
export async function getUserByNameID(nameID: string) {
  try {
    const user = await User.findOne({ nameID });
    return user;
  } catch (error) {
    console.error('Error finding user:', error);
    throw new InternalError('Failed to find user');
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError(`Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update user by ID
 */
export async function updateUserById(id: string, updateData: Partial<CreateUserParams>) {
  try {
    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update user by nameID
 */
export async function updateUserByNameID(nameID: string, updateData: Partial<CreateUserParams>) {
  try {
    const user = await User.findOne({ nameID });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (updateData.username) user.username = updateData.username;
    if (updateData.email) user.email = updateData.email;
    if (updateData.firstName) user.firstName = updateData.firstName;
    if (updateData.lastName) user.lastName = updateData.lastName;
    if (updateData.groups) user.groups = updateData.groups;
    if (updateData.role) user.role = updateData.role;
    user.updated = new Date();

    await user.save();
    return user;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete user by ID
 */
export async function deleteUserById(id: string) {
  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy exports for backward compatibility
export const getUserbynameID = getUserByNameID;
