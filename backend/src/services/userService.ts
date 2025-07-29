import { getConnection } from '../lib/mongodb';
import { User } from '../models/user';

export class UserService {
  private db = getConnection();

  constructor() {
    console.log('✅ User service initialized');
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await User.find().sort({ createdAt: -1 });
    } catch (error) {
      console.error('❌ Error getting users:', error);
      return [];
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      return await User.findById(id);
    } catch (error) {
      console.error('❌ Error getting user:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await User.findOne({ email });
    } catch (error) {
      console.error('❌ Error getting user by email:', error);
      return null;
    }
  }

  async createUser(userData: any): Promise<User | null> {
    try {
      const user = new User(userData);
      await user.save();
      return user;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return null;
    }
  }

  async updateUser(id: string, updateData: any): Promise<User | null> {
    try {
      return await User.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      return false;
    }
  }

  async getAdmins(): Promise<User[]> {
    try {
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
      return admins.map((admin: any) => new User(admin));
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
}

export const userService = new UserService(); 