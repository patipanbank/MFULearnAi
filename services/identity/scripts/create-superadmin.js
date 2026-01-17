const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Usage: node create-superadmin.js <username> <password> [email]
// Example: node create-superadmin.js admin password123 admin@mfu.ac.th

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfulearnai-auth';
const SALT_ROUNDS = 10;

if (process.argv.length < 4) {
    console.error('Usage: node create-superadmin.js <username> <password> [email]');
    process.exit(1);
}

const [, , username, password, emailArg] = process.argv;
const email = emailArg || 'admin@mfu.ac.th';

// Define Schema locally to avoid TS compilation requirement
const UserSchema = new mongoose.Schema({
    nameID: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    department: { type: String },
    role: { type: String, enum: ['student', 'staff', 'admin', 'superadmin'], default: 'student' },
    groups: [{ type: String }],
    password: { type: String },
    isActive: { type: Boolean, default: true },
    loginCount: { type: Number, default: 0 }
}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

async function run() {
    try {
        console.log(`Connecting to MongoDB at ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);
        console.log('Connected successfully.');

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            nameID: username,
            username: username,
            email: email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'superadmin', // Key role
            groups: ['admin_grp', 'superadmin_grp'],
            department: 'IT',
            password: hashedPassword,
            isActive: true
        };

        // Upsert User
        const result = await User.findOneAndUpdate(
            { username: username },
            userData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('SuperAdmin created/updated successfully:');
        console.log(`ID: ${result._id}`);
        console.log(`Username: ${result.username}`);
        console.log(`Role: ${result.role}`);

    } catch (err) {
        console.error('Error creating SuperAdmin:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
