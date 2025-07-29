import { getConnection } from '../lib/mongodb';
import { User, IUser } from '../models/user';

export class UserService {
  private db = getConnection();

  constructor() {
    console.log('✅ User service initialized');
  }

  async getAllUsers(): Promise<IUser[]> {
    try {
      return await User.find().sort({ createdAt: -1 }).exec();
    } catch (error) {
      console.error('❌ Error getting users:', error);
      return [];
    }
  }

  async getUserById(id: string): Promise<IUser | null> {
    try {
      return await User.findById(id).exec();
    } catch (error) {
      console.error('❌ Error getting user:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      return await User.findOne({ email }).exec();
    } catch (error) {
      console.error('❌ Error getting user by email:', error);
      return null;
    }
  }

  async createUser(userData: any): Promise<IUser | null> {
    try {
      const user = new User(userData);
      await user.save();
      return user;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return null;
    }
  }

  async updateUser(id: string, updateData: any): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(id, updateData, { new: true }).exec();
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndDelete(id).exec();
      return !!result;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      return false;
    }
  }

  async getAdmins(): Promise<IUser[]> {
    try {
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).exec();
      return admins;
    } catch (error) {
      console.error('❌ Error getting admins:', error);
      return [];
    }
  }

  async getUserStats(): Promise<any> {
    try {
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const adminUsers = await User.countDocuments({ role: { $in: ['admin', 'superadmin'] } });
      
      return {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers
      };
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      return { total: 0, active: 0, admins: 0 };
    }
  }

  async find_or_create_saml_user(userProfile: any): Promise<IUser> {
    try {
      // Check if user exists by nameID or email
      let user = await User.findOne({
        $or: [
          { nameID: userProfile.nameID },
          { email: userProfile.email }
        ]
      });

      if (!user) {
        // Create new user
        user = new User({
          nameID: userProfile.nameID,
          username: userProfile.username,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          department: userProfile.department,
          groups: userProfile.groups || [],
          role: 'user', // Default role
          isActive: true,
          lastLogin: new Date()
        });
        await user.save();
        console.log(`✅ Created new SAML user: ${user.username}`);
      } else {
        // Update existing user
        user.nameID = userProfile.nameID;
        user.username = userProfile.username;
        user.email = userProfile.email;
        user.firstName = userProfile.firstName;
        user.lastName = userProfile.lastName;
        user.department = userProfile.department;
        user.groups = userProfile.groups || [];
        user.lastLogin = new Date();
        await user.save();
        console.log(`✅ Updated existing SAML user: ${user.username}`);
      }

      return user;
    } catch (error) {
      console.error('❌ Error in find_or_create_saml_user:', error);
      throw error;
    }
  }

  async find_admin_by_username(username: string): Promise<IUser | null> {
    try {
      return await User.findOne({ 
        username, 
        role: { $in: ['admin', 'superadmin'] } 
      }).exec();
    } catch (error) {
      console.error('❌ Error finding admin by username:', error);
      return null;
    }
  }

  async verify_admin_password(password: string, hashedPassword: string): Promise<boolean> {
    try {
      // For now, implement basic password verification
      // In production, you should use proper password hashing with bcrypt
      return hashedPassword === password;
    } catch (error) {
      console.error('❌ Error verifying admin password:', error);
      return false;
    }
  }
}

export const userService = new UserService(); 