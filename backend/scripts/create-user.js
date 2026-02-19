const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotnet = require('dotenv');
const path = require('path');

dotnet.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu-learn-ai';

// --- Define Schemas Inline to avoid TS Compilation issues ---
const UserSchema = new mongoose.Schema({
    nameID: { type: String, required: false, unique: true, sparse: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    department: { type: String },
    departmentId: { type: String },
    role: {
        type: String,
        enum: ['student', 'staff', 'admin', 'superadmin'],
        default: 'student'
    },
    groups: [{ type: String }],
    googleId: { type: String },
    picture: { type: String },
    password: { type: String },
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    permissions: [{ type: String }]
}, { timestamps: true });

const DepartmentSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    faculty: { type: String },
    metadata: { type: Object }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Department = mongoose.model('Department', DepartmentSchema);

// --- Logic ---

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
        name: deptName
    });

    return dept.code;
};

const createAdmin = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const args = process.argv.slice(2);
        if (args.length < 3) {
            console.log('Usage: node scripts/create-user.js <username> <email> <password> [role] [department]');
            console.log('Roles: student, staff, admin, superadmin (default: admin)');
            process.exit(1);
        }

        const [username, email, password, roleArg, departmentArg] = args;
        const role = roleArg || 'admin';
        const departmentName = departmentArg || 'IT'; // Default to IT

        if (!['student', 'staff', 'admin', 'superadmin'].includes(role)) {
            console.error('Invalid role. Must be one of: student, staff, admin, superadmin');
            process.exit(1);
        }

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            console.log(`User ${username} / ${email} already exists.`);
            console.log('Updating user...');

            // Update password if provided
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            existingUser.password = hashedPassword;
            existingUser.role = role;

            if (departmentArg) {
                const deptId = await resolveDepartmentId(departmentArg);
                existingUser.department = departmentArg;
                existingUser.departmentId = deptId;
            }

            await existingUser.save();
            console.log(`User updated successfully to role: ${role}`);
        } else {
            console.log('Creating new user...');

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const deptId = await resolveDepartmentId(departmentName);

            const newUser = new User({
                username,
                email,
                password: hashedPassword,
                role,
                department: departmentName,
                departmentId: deptId,
                firstName: 'System',
                lastName: role.charAt(0).toUpperCase() + role.slice(1),
                isActive: true
            });

            await newUser.save();
            console.log(`User created successfully with role: ${role}, Dept: ${departmentName} (${deptId})`);
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('Error creating user:', error);
        process.exit(1);
    }
};

createAdmin();
