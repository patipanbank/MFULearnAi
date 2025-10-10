import { samlService, SamlUserProfile } from './samlService';
import { userService } from './userService';
import { jwtService } from './jwtService';
import { User } from '../models/user';

class AuthService {
  /**
   * จัดการ SAML authentication flow
   * - Map SAML profile
   * - Create/update user
   * - Generate JWT token
   */
  async handleSamlLogin(samlProfile: any): Promise<{ token: string; user: User }> {
    // 1. Map SAML profile to user profile
    const userProfile: SamlUserProfile = samlService.mapSamlProfile(samlProfile);

    // 2. Create or update user in database
    const user = await userService.find_or_create_saml_user(userProfile);
    console.log(`👤 User authenticated: ${user.username} (${user.email})`);

    // 3. Generate JWT token
    const token = jwtService.createSamlToken(user);

    return { token, user };
  }

  /**
   * จัดการ Admin login
   * - Verify credentials
   * - Generate JWT token
   */
  async handleAdminLogin(username: string, password: string): Promise<{ token: string; user: User }> {
    // 1. Find admin user
    const user = await userService.find_admin_by_username(username);
    if (!user || !user.password) {
      throw new Error('User account not found or password not set');
    }

    // 2. Verify password
    const isMatch = await userService.verify_admin_password(password, user.password);
    if (!isMatch) {
      throw new Error('Password is incorrect');
    }

    // 3. Generate JWT token
    const token = jwtService.createAdminToken(user);

    // Remove password from response
    const userWithoutPassword = { ...user.toObject(), password: undefined };

    return { token, user: new User(userWithoutPassword) };
  }

  /**
   * Refresh JWT token
   */
  refreshToken(currentUser: any): string {
    return jwtService.refreshToken(currentUser);
  }

  /**
   * Format user response สำหรับ /me endpoint
   */
  formatUserResponse(user: any) {
    return {
      _id: { $oid: user.sub || user._id },
      nameID: user.nameID,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      role: user.role,
      groups: user.groups || [],
      tokenQuota: user.tokenQuota || 100000,
      dailyTokenLimit: user.dailyTokenLimit || 50000,
      created: user.created || new Date(),
      updated: user.updated || new Date()
    };
  }
}

export const authService = new AuthService();
