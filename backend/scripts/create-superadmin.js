const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Self-bootstrapping: auto-install dependencies if node_modules is missing
// ---------------------------------------------------------------------------
const BACKEND_DIR = path.resolve(__dirname, '..');
const REQUIRED_PACKAGES = ['mongoose', 'bcryptjs', 'dotenv'];

function ensureDependencies() {
    const missing = REQUIRED_PACKAGES.filter((pkg) => {
        try {
            require.resolve(pkg, { paths: [BACKEND_DIR] });
            return false;
        } catch {
            return true;
        }
    });

    if (missing.length > 0) {
        console.log(`[bootstrap] Missing packages: ${missing.join(', ')}`);
        console.log('[bootstrap] Running "npm install" in', BACKEND_DIR, '...');
        try {
            execSync('npm install --omit=dev', {
                cwd: BACKEND_DIR,
                stdio: 'inherit',
            });
            console.log('[bootstrap] npm install completed.');
        } catch (err) {
            console.error('[bootstrap] npm install failed:', err.message);
            process.exit(1);
        }
    }
}

ensureDependencies();

// ---------------------------------------------------------------------------
// Actual imports (now guaranteed to exist)
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../infrastructure/compose/.env') });

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
    nameID: { type: String, required: false, unique: true, sparse: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    department: { type: String },
    departmentId: { type: String },
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

// Helper to resolve Department ID
const resolveDepartmentId = async (deptName) => {
    if (!deptName) return '';

    // Check if department exists by name
    let dept = await Department.findOne({ name: deptName });

    // If found, return its code
    if (dept) return dept.code;

    // If not found, generate code and create
    const code = deptName.trim().toUpperCase().replace(/\s+/g, '_');
    console.log(`Creating new department: ${deptName} (${code})`);

    dept = await Department.create({
        code,
        name: deptName,
        faculty: 'System'
    });

    return dept.code;
};

async function run() {
    try {
        console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected successfully.');

        // 1. Resolve Department
        const deptId = await resolveDepartmentId(department);

        // 2. Create/Update Superadmin
        console.log(`Creating superadmin '${username}'...`);
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            username: username,
            email: email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'superadmin',
            // permissions: ['*'], // Removed: specific permissions handled via role logic usually
            department: department,
            departmentId: deptId,
            password: hashedPassword,
            isActive: true,
            loginCount: 0
        };

        // Check if user exists to preserve some fields if needed, but for superadmin script usually we overwrite/upsert
        // Using findOneAndUpdate with upsert
        console.log('Upserting User to DB...');
        const result = await User.findOneAndUpdate(
            { username: username },
            userData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('User upsert complete.');

        console.log('-----------------------------------');
        console.log('SuperAdmin Account Ready:');
        console.log(`ID: ${result._id}`);
        console.log(`Username: ${result.username}`);
        console.log(`Role: ${result.role}`);
        console.log(`Department: ${result.department} (${result.departmentId})`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Error creating SuperAdmin:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
