import { getUserbynameID, createUser } from '../services/user.service';
import { Request, Response } from 'express';
import { generateToken } from '../middleware/auth';
import { UserRole } from '../models/User';
import { asyncHandler } from '../middleware/errorHandler';
import { BadRequestError, InternalError } from '../errors';

/**
 * POST /api/auth/guest - Guest login endpoint
 */
export const guestLogin = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const body: { nameID: string } = req.body;
  if (!body || !body.nameID) {
    throw new BadRequestError('nameID is required');
  }

  let user = await getUserbynameID(body.nameID);
  if (!user) {
    user = await createUser({ nameID: body.nameID, role: 'Students' as UserRole });
    if (!user) {
      throw new InternalError('Failed to create user');
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

  const token = generateToken(userData, '1h');

  const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');
  const redirectUrl = `/auth-callback?token=${token}&user_data=${encodedUserData}`;
  res.status(200).send(redirectUrl.toString());
});