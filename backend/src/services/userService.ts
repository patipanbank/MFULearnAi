import { getDatabase } from '../lib/mongodb';
import { User, UserRole } from '../models/user';
import { verify_password, get_password_hash } from '../utils/security';
import { ensure_department_exists } from './departmentService';
import mongoose from 'mongoose';

class UserService {
  async get_user_by_id(user_id: string) {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');
    
    const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(user_id) });
    if (user && user._id) {
      (user as any)._id = user._id.toString();
    }
    return user ? new User(user) : null;
  }

  async get_all_admins() {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');
    
    const admins = await db.collection('users')
      .find({ role: UserRole.ADMIN })
      .sort({ created: -1 })
      .toArray();
    
    for (const admin of admins) {
      if (admin._id) {
        (admin as any)._id = admin._id.toString();
      }
    }
    return admins.map(admin => new User(admin));
  }

  async find_admin_by_username(username: string) {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');
    
    const user = await db.collection('users').findOne({
      username,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }
    });
    
    if (user && user._id) {
      (user as any)._id = user._id.toString();
    }
    return user ? new User(user) : null;
  }

  async verify_admin_password(password: string, hashed_password: string): Promise<boolean> {
    return verify_password(password, hashed_password);
  }

  async find_or_create_saml_user(profile: any) {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');
    
    const username = profile.username;
    if (!username) {
      throw new Error('Username is required from SAML profile');
    }

    const department_name = profile.department?.toLowerCase() || '';
    if (department_name) {
      await ensure_department_exists(department_name);
    }
    
    let groups = profile.groups || [];
    if (!Array.isArray(groups)) {
      groups = [groups];
    }

    // Role mapping logic เหมือน Python
    const map_group_to_role = (user_groups: string[]): UserRole => {
      const is_student = user_groups.some(g => g === 'S-1-5-21-893890582-1041674030-1199480097-43779');
      return is_student ? UserRole.STUDENTS : UserRole.STAFFS;
    };

    const user_data_to_update = {
      nameID: profile.nameID,
      username,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      department: department_name,
      groups,
      role: map_group_to_role(groups),
      updated: new Date()
    };

    // Remove undefined values
    const clean_data = Object.fromEntries(
      Object.entries(user_data_to_update).filter(([_, v]) => v !== undefined)
    );

    const result = await db.collection('users').findOneAndUpdate(
      { username },
      {
        $set: clean_data,
        $setOnInsert: { created: new Date() }
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    if (result && result._id) {
      (result as any)._id = result._id.toString();
    }
    
    return new User(result);
  }
}

export const userService = new UserService(); 