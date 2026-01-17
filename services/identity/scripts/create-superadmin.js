const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Usage: node create-superadmin.js <username> <password> [email] [department]
// Example: node create-superadmin.js admin password123 admin@mfu.ac.th IT

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfulearnai-auth';
const SALT_ROUNDS = 10;

if (process.argv.length < 4) {
    console.error('Usage: node create-superadmin.js <username> <password> [email] [department]');
    process.exit(1);
}

const [, , username, password, emailArg, deptArg] = process.argv;
const email = emailArg || 'admin@mfu.ac.th';
const department = deptArg || 'IT';

// 1. Define User Schema
const UserSchema = new mongoose.Schema({
    nameID: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    department: { type: String },
    role: { type: String, enum: ['student', 'staff', 'admin', 'superadmin'], default: 'student' },
    groups: [{ type: String }],
    googleId: { type: String },
    password: { type: String },
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    permissions: [{ type: String }]
}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

// 2. Define Department Schema
const DepartmentSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    faculty: { type: String },
    metadata: { type: Object }
}, {
    timestamps: true
});

const Department = mongoose.model('Department', DepartmentSchema);

async function run() {
    try {
        console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected successfully.');

        // 1. Create/Update Department
        if (department) {
            console.log(`Ensuring department '${department}' exists...`);
            await Department.findOneAndUpdate(
                { code: department },
                {
                    code: department,
                    name: department,
                    faculty: 'System'
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        // 2. Create/Update Superadmin
        console.log(`Creating superadmin '${username}'...`);
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            nameID: username,
            username: username,
            email: email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'superadmin',
            groups: ['admin_grp', 'superadmin_grp'],
            department: department,
            password: hashedPassword,
            isActive: true,
            permissions: ['*'] // wildcard permission for superadmin
        };

        const result = await User.findOneAndUpdate(
            { username: username },
            userData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('-----------------------------------');
        console.log('SuperAdmin Account Ready:');
        console.log(`ID: ${result._id}`);
        console.log(`Username: ${result.username}`);
        console.log(`Role: ${result.role}`);
        console.log(`Department: ${result.department}`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Error creating SuperAdmin:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
