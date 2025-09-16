# 👨‍💼 MFU Learn AI - Admin Setup Guide

This guide will help you create admin and super admin users for the MFU Learn AI system.

## 🚀 Quick Start

### Method 1: Interactive Setup (Recommended)

```bash
# Make script executable
chmod +x create_admin.sh

# Run interactive setup
./create_admin.sh
```

### Method 2: Using Environment Variables

```bash
# Copy environment template
cp create_admin_env.example .env

# Edit the values in .env file
nano .env

# Source the environment
source .env

# Run the script
./create_admin.sh
```

### Method 3: Direct Environment Export

```bash
export MONGODB_URI="mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin"
export ADMIN_USERNAME="superadmin"
export ADMIN_PASSWORD="SecurePassword123!"
export ADMIN_EMAIL="superadmin@mfu.ac.th"
export ADMIN_ROLE="SuperAdmin"

./create_admin.sh
```

## 📋 Available Roles

### 🎯 **Admin**
- **Department Management**: Create and manage department collections/agents
- **Permissions**: Same as STAFF level
- **Access**: Department-level resources only

### 🎯 **SuperAdmin**
- **System Management**: Full system administration
- **Usage Management**: View/modify all user quotas and usage
- **System Statistics**: Access queue stats, chat analytics
- **All Admin Permissions**: Plus system-wide management

## 🛠 Manual Installation (If needed)

### Prerequisites

```bash
# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using snap
sudo snap install node --classic

# Verify installation
node --version
npm --version
```

### Install Dependencies

```bash
# Install required packages
npm install mongoose bcryptjs

# Or if package.json doesn't exist
npm init -y
npm install mongoose bcryptjs
```

### Run Script Directly

```bash
# Run Node.js script directly
node create_admin.js
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/mfu_chatbot` | ✅ |
| `ADMIN_USERNAME` | Admin username | `admin` | ✅ |
| `ADMIN_PASSWORD` | Admin password | `SecurePass123!` | ✅ |
| `ADMIN_EMAIL` | Admin email | `admin@mfu.ac.th` | ✅ |
| `ADMIN_FIRSTNAME` | First name | `System` | ❌ |
| `ADMIN_LASTNAME` | Last name | `Administrator` | ❌ |
| `ADMIN_DEPARTMENT` | Department | `IT` | ❌ |
| `ADMIN_ROLE` | Role (Admin/SuperAdmin) | `SuperAdmin` | ❌ |

### Default Values

```bash
# Default MongoDB URI
mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin

# Default Role
Admin

# Default Quotas
Token Quota: 100,000 (admins get higher limits)
Daily Limit: 50,000
```

## 📖 Usage Examples

### Create SuperAdmin for Production

```bash
export MONGODB_URI="mongodb://root:password@your-server:27017/mfu_chatbot?authSource=admin"
export ADMIN_USERNAME="superadmin"
export ADMIN_PASSWORD="VerySecurePassword123!"
export ADMIN_EMAIL="superadmin@mfu.ac.th"
export ADMIN_DEPARTMENT="IT"
export ADMIN_ROLE="SuperAdmin"

./create_admin.sh
```

### Create Department Admin

```bash
export MONGODB_URI="mongodb://localhost:27017/mfu_chatbot"
export ADMIN_USERNAME="it_admin"
export ADMIN_PASSWORD="ITAdminPass123!"
export ADMIN_EMAIL="it.admin@mfu.ac.th"
export ADMIN_DEPARTMENT="IT"
export ADMIN_ROLE="Admin"

./create_admin.sh
```

### Update Existing User

The script will detect existing users and ask if you want to update them:

```
❌ User with username "admin" already exists!
🔄 Do you want to update this user? (y/N): y
```

## 🔒 Security Notes

### Password Requirements
- ✅ Minimum 6 characters (recommended 12+)
- ✅ Use strong passwords with mixed case, numbers, symbols
- ✅ Don't use common passwords

### Production Security
```bash
# Use secure passwords
ADMIN_PASSWORD="$(openssl rand -base64 32)"

# Set proper file permissions
chmod 600 .env

# Don't commit credentials to git
echo ".env" >> .gitignore
```

## 🚨 Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Test connection
mongo mongodb://root:1234@localhost:27017/mfu_chatbot?authSource=admin
```

**2. Permission Denied**
```bash
# Make script executable
chmod +x create_admin.sh

# Check file permissions
ls -la create_admin.sh
```

**3. Node.js Not Found**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**4. Dependencies Missing**
```bash
# Install dependencies manually
npm install mongoose bcryptjs
```

### Script Help

```bash
# Show help
./create_admin.sh --help

# Show environment example
./create_admin.sh --env-example
```

## 📝 Logs and Verification

### Successful Creation
```
✅ Connected to MongoDB successfully!
✅ Admin user created successfully!

📋 User Details:
   Username: superadmin
   Email: superadmin@mfu.ac.th
   Role: SuperAdmin
   Department: IT
   Token Quota: 100000
   Daily Limit: 50000

💡 You can now login at: /admin/login
```

### Login Testing
```bash
# Test admin login at:
https://your-domain.com/admin/login

# Or local development:
http://localhost:3000/admin/login
```

## 🔄 Next Steps

After creating admin users:

1. **Test Login**: Verify admin can login at `/admin/login`
2. **Set Quotas**: Adjust user quotas as needed
3. **Configure Permissions**: Review department assignments
4. **System Monitoring**: SuperAdmins can access system stats
5. **Security Review**: Ensure passwords are secure

## 💡 Tips

- **Use SuperAdmin sparingly**: Only for system administration
- **Create Department Admins**: For each department/faculty
- **Regular Updates**: Update admin credentials periodically
- **Backup**: Keep admin credentials secure and backed up
- **Monitor Usage**: Track admin actions and system usage