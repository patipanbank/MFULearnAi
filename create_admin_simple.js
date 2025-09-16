#!/usr/bin/env node

/**
 * Create Admin/Super Admin Script - Ultra simple version
 * Usage: node create_admin_simple.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load environment variables
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

// User roles
const UserRole = {
  ADMIN: 'Admin',
  SUPER_ADMIN: 'SuperAdmin'
};

// User Schema
const UserSchema = new mongoose.Schema({
  nameID: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String },
  email: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  department: { type: String },
  role: { type: String, enum: Object.values(UserRole), default: UserRole.ADMIN },
  groups: { type: [String], default: [] },
  tokenQuota: { type: Number, default: 100000 },
  dailyTokenLimit: { type: Number, default: 50000 },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Create a single readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simple question function
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Hash password
async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

// Main function
async function main() {
  try {
    loadEnvFile();

    console.log('🚀 MFU Learn AI - Admin Creation Script');
    console.log('=====================================\n');

    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin';

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!\n');

    console.log('📝 Please enter admin details:\n');

    const username = (await ask('👤 Username: ')).trim();
    if (!username) {
      console.log('❌ Username is required!');
      return;
    }

    // Check existing user
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log(`❌ User "${username}" already exists!`);
      const overwrite = (await ask('🔄 Update this user? (y/N): ')).trim().toLowerCase();
      if (overwrite !== 'y' && overwrite !== 'yes') {
        console.log('❌ Operation cancelled.');
        return;
      }
    }

    const email = (await ask('📧 Email: ')).trim();
    if (!email || !email.includes('@')) {
      console.log('❌ Valid email is required!');
      return;
    }

    const password = (await ask('🔒 Password: ')).trim();
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters!');
      return;
    }

    const firstName = (await ask('👤 First Name (optional): ')).trim();
    const lastName = (await ask('👤 Last Name (optional): ')).trim();
    const department = (await ask('🏢 Department (optional): ')).trim();

    console.log('\n📋 Available Roles:');
    console.log('1. Admin');
    console.log('2. SuperAdmin');
    const roleChoice = (await ask('🎯 Choose role (1/2, default=1): ')).trim() || '1';

    const role = roleChoice === '2' ? UserRole.SUPER_ADMIN : UserRole.ADMIN;

    console.log('\n🔐 Hashing password...');
    const hashedPassword = await hashPassword(password);

    const userData = {
      nameID: username,
      username,
      password: hashedPassword,
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      department: department || undefined,
      role,
      groups: [],
      tokenQuota: 100000,
      dailyTokenLimit: 50000,
      created: new Date(),
      updated: new Date()
    };

    console.log('💾 Saving user...');

    if (existingUser) {
      await User.findOneAndUpdate({ username }, userData);
      console.log('✅ Admin user updated successfully!');
    } else {
      await new User(userData).save();
      console.log('✅ Admin user created successfully!');
    }

    console.log('\n📋 User Details:');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role}`);
    console.log(`   Department: ${department || 'Not specified'}`);

    console.log('\n🎉 Admin creation completed!');
    console.log('💡 You can now login at: /admin/login');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n👋 Goodbye!');
  rl.close();
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

// Run
main();