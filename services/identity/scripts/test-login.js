const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mfulearnai-auth';

// Define the Schema exactly as the App expects it (simplified for testing)
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String
}, { strict: false }); // Strict false to read all fields

// Add the method manually to test 'implementation'
UserSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'password';

async function testLogin() {
    try {
        console.log(`Connecting to ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);

        console.log(`Searching for user: ${username}`);
        const user = await User.findOne({ username });

        if (!user) {
            console.error('User NOT FOUND');
            process.exit(1);
        }

        console.log('User found:', {
            id: user._id,
            username: user.username,
            role: user.role,
            hasPassword: !!user.password,
            passwordHash: user.password ? user.password.substring(0, 10) + '...' : 'buffers'
        });

        console.log(`Testing password: '${password}'`);

        // Test 1: Direct bcrypt compare
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Direct bcrypt.compare result: ${isMatch}`);

        // Test 2: Method check
        if (typeof user.comparePassword === 'function') {
            const methodResult = await user.comparePassword(password);
            console.log(`user.comparePassword() result: ${methodResult}`);
        } else {
            console.log('user.comparePassword is NOT a function');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testLogin();
