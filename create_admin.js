#!/usr/bin/env node

/**
 * Create Admin/Super Admin Script
 * Usage: node create_admin.js
 *
 * Environment Variables:
 * - MONGODB_URI: MongoDB connection string
 * - ADMIN_USERNAME: Default admin username
 * - ADMIN_PASSWORD: Default admin password
 * - ADMIN_EMAIL: Default admin email
 * - ADMIN_ROLE: Default role (Admin or SuperAdmin)
 * - ADMIN_DEPARTMENT: Default department
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load .env file if it exists
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    console.log('📄 Loading environment variables from .env file...');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent.split('\n').filter(line => {
      return line.trim() && !line.trim().startsWith('#') && line.includes('=');
    });

    envVars.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^"|"$/g, '').trim();
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    });
    console.log('✅ Environment variables loaded from .env\n');
  }
}

// User Role enum
const UserRole = {
  ADMIN: 'Admin',
  STAFFS: 'Staffs',
  STUDENTS: 'Students',
  SUPER_ADMIN: 'SuperAdmin'
};

// User Schema (matching the existing schema)
const UserSchema = new mongoose.Schema({
  nameID: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String },
  email: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  department: { type: String },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.STUDENTS
  },
  groups: { type: [String], default: [] },
  tokenQuota: { type: Number, default: 10000 },
  dailyTokenLimit: { type: Number, default: 10000 },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Helper function to hide password input
function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    process.stdin.on('data', (key) => {
      if (key === '\u0003') { // Ctrl+C
        process.exit();
      }
      if (key === '\r' || key === '\n') { // Enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(password);
      } else if (key === '\u007f') { // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += key;
        process.stdout.write('*');
      }
    });
  });
}

// Hash password function
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Main function
async function createAdmin() {
  try {
    // Load .env file first
    loadEnvFile();

    console.log('🚀 MFU Learn AI - Admin Creation Script');
    console.log('=====================================\n');

    // Get MongoDB connection string
    // Try different MongoDB environment variable names
    const mongoUri = process.env.MONGODB_URI ||
                    process.env.DATABASE_URL ||
                    await askQuestion('📍 MongoDB URI (default: mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin): ') ||
                    'mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin';

    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!\n');

    // Get user input
    const username = process.env.ADMIN_USERNAME ||
                    await askQuestion('👤 Username: ');

    if (!username) {
      throw new Error('Username is required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log(`❌ User with username "${username}" already exists!`);

      const overwrite = await askQuestion('🔄 Do you want to update this user? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled.');
        process.exit(1);
      }
    }

    const email = process.env.ADMIN_EMAIL ||
                 await askQuestion('📧 Email: ');

    if (!email) {
      throw new Error('Email is required');
    }

    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    const password = process.env.ADMIN_PASSWORD ||
                    await askPassword('🔒 Password: ');

    if (!password) {
      throw new Error('Password is required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const firstName = process.env.ADMIN_FIRSTNAME ||
                     await askQuestion('👤 First Name (optional): ') || '';

    const lastName = process.env.ADMIN_LASTNAME ||
                    await askQuestion('👤 Last Name (optional): ') || '';

    const department = process.env.ADMIN_DEPARTMENT ||
                      await askQuestion('🏢 Department (optional): ') || '';

    console.log('\n📋 Available Roles:');
    console.log('1. Admin - Department management permissions');
    console.log('2. SuperAdmin - System-wide management permissions');

    const roleChoice = process.env.ADMIN_ROLE ||
                      await askQuestion('🎯 Choose role (1=Admin, 2=SuperAdmin, default=1): ') || '1';

    let role;
    switch (roleChoice) {
      case '1':
      case 'Admin':
      case 'admin':
        role = UserRole.ADMIN;
        break;
      case '2':
      case 'SuperAdmin':
      case 'superadmin':
        role = UserRole.SUPER_ADMIN;
        break;
      default:
        role = UserRole.ADMIN;
    }

    console.log('\n🔐 Hashing password...');
    const hashedPassword = await hashPassword(password);

    const userData = {
      nameID: username, // Use username as nameID
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      department,
      role,
      groups: [],
      tokenQuota: 100000, // Higher quota for admins
      dailyTokenLimit: 50000, // Higher daily limit for admins
      created: new Date(),
      updated: new Date()
    };

    console.log('\n💾 Creating/Updating admin user...');

    if (existingUser) {
      await User.findOneAndUpdate({ username }, userData, { new: true });
      console.log('✅ Admin user updated successfully!');
    } else {
      const newUser = new User(userData);
      await newUser.save();
      console.log('✅ Admin user created successfully!');
    }

    console.log('\n📋 User Details:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role}`);
    console.log(`   Department: ${department || 'Not specified'}`);
    console.log(`   Token Quota: ${userData.tokenQuota}`);
    console.log(`   Daily Limit: ${userData.dailyTokenLimit}`);

    console.log('\n🎉 Admin creation completed successfully!');
    console.log('\n💡 You can now login at: /admin/login');

  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed.');
    }
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  rl.close();
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close();
  }
  process.exit(0);
});

// Run the script
if (require.main === module) {
  createAdmin();
}

module.exports = { createAdmin };