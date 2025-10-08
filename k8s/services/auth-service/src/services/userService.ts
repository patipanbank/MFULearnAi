import { getDatabase } from '../lib/mongodb';
import { User, UserRole } from '../models/user';
import { verify_password, get_password_hash } from '../utils/security';
import axios from 'axios';
import config from '../config/config';
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

    const department_name = profile.department?.toLowerCase().trim() || '';
    let departmentCreated = null;
    if (department_name) {
      try {
        // Call Department Service to ensure department exists
        const response = await axios.post(
          `${config.DEPARTMENT_SERVICE_URL}/api/departments/ensure`,
          {
            departmentKey: department_name,
            displayName: profile.department?.trim()
          }
        );
        departmentCreated = response.data;
        console.log(`✅ Department ensured via HTTP: ${department_name}`, departmentCreated);
      } catch (error: any) {
        console.error(`❌ Failed to ensure department via HTTP:`, error.message);
        // Continue even if department service fails
      }
    }

    let groups = profile.groups || [];
    if (!Array.isArray(groups)) {
      groups = [groups];
    }

    // Role mapping logic
    const map_group_to_role = (user_groups: string[]): UserRole => {
      console.log(`🔍 Role mapping - Input groups: ${JSON.stringify(user_groups)}`);

      // Check SID for Students
      const is_student = user_groups.some(g => g === 'S-1-5-21-893890582-1041674030-1199480097-43779');
      const role = is_student ? UserRole.STUDENTS : UserRole.STAFFS;

      console.log(`🔍 Role mapping - is_student: ${is_student}, result: ${role}`);
      return role;
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

    // Get existing user to check for department changes
    const existingUser = await db.collection('users').findOne({ username });

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

    // Handle department count changes via HTTP
    if (department_name) {
      try {
        if (!existingUser) {
          // New user - increment count
          await axios.post(
            `${config.DEPARTMENT_SERVICE_URL}/api/departments/webhooks/user-created`,
            { departmentKey: department_name }
          );
          console.log(`✅ User created webhook sent for department: ${department_name}`);
        } else if (existingUser.department !== department_name) {
          // Department changed - update counts
          await axios.post(
            `${config.DEPARTMENT_SERVICE_URL}/api/departments/webhooks/user-department-changed`,
            {
              oldDepartmentKey: existingUser.department,
              newDepartmentKey: department_name
            }
          );
          console.log(`✅ User department changed webhook sent: ${existingUser.department} -> ${department_name}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to send department webhook:`, error.message);
        // Continue even if webhook fails
      }
    }

    return new User(result);
  }
}

export const userService = new UserService();
