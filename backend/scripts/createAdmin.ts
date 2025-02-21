import { connectDB } from '../lib/mongodb';
import User from '../models/User';
import bcrypt from 'bcrypt';

async function createAdminUser() {
  try {
    await connectDB();

    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = new User({
      username: 'admin',
      password: hashedPassword,
      isAdmin: true,
      groups: ['Admin'],
      email: 'admin@mfu.ac.th',
      firstName: 'Admin',
      lastName: 'User',
      nameID: 'admin',
      role: 'Admin'
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser(); 