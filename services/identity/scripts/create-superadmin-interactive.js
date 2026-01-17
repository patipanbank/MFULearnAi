const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');

// Config
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfulearnai-auth'; // Default local connection
const SALT_ROUNDS = 10;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// User Schema (Simplified version of services/identity/src/models/User.ts)
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

async function createSuperAdmin() {
    try {
        console.log('\n--- Create SuperAdmin User ---\n');

        const uri = await question(`MongoDB URI [${MONGO_URI}]: `) || MONGO_URI;

        console.log(`\nConnecting to ${uri}...`);
        await mongoose.connect(uri);
        console.log('Connected to MongoDB successfully.\n');

        const username = await question('Username: ');
        if (!username) throw new Error('Username is required');

        const password = await question('Password: ');
        if (!password) throw new Error('Password is required');

        const email = await question('Email (optional, default: admin@mfu.ac.th): ') || 'admin@mfu.ac.th';

        // Check if user exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            const overwrite = await question(`\nUser '${username}' already exists. Overwrite/Update to SuperAdmin? (y/N): `);
            if (overwrite.toLowerCase() !== 'y') {
                console.log('Operation cancelled.');
                process.exit(0);
            }
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            nameID: username, // Use username as nameID for local admin
            username,
            email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'superadmin',
            password: hashedPassword,
            groups: ['admin_grp'],
            isActive: true,
            department: 'IT'
        };

        if (existingUser) {
            await User.updateOne({ _id: existingUser._id }, userData);
            console.log(`\nUser '${username}' updated to SuperAdmin successfully!`);
        } else {
            await User.create(userData);
            console.log(`\nSuperAdmin user '${username}' created successfully!`);
        }

    } catch (error) {
        console.error('\nError:', error.message);
    } finally {
        await mongoose.disconnect();
        rl.close();
        process.exit(0);
    }
}

createSuperAdmin();
