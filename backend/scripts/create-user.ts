import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu-learn-ai';

const createAdmin = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const args = process.argv.slice(2);
        if (args.length < 3) {
            console.log('Usage: ts-node scripts/create-user.ts <username> <email> <password> [role]');
            console.log('Roles: student, staff, admin, superadmin (default: admin)');
            process.exit(1);
        }

        const [username, email, password, roleArg] = args;
        const role = roleArg || 'admin';

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
            existingUser.role = role as any;

            // Update other fields if needed, or leave as is
            // existingUser.firstName = 'Admin';
            // existingUser.lastName = 'User';

            await existingUser.save();
            console.log(`User updated successfully to role: ${role}`);
        } else {
            console.log('Creating new user...');

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new User({
                username,
                email,
                password: hashedPassword,
                role,
                firstName: 'System',
                lastName: role.charAt(0).toUpperCase() + role.slice(1),
                isActive: true
            });

            await newUser.save();
            console.log(`User created successfully with role: ${role}`);
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
