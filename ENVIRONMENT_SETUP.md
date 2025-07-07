# 🌐 **Environment Setup Guide**

## 📋 **Required Environment Variables**

### **Application Settings**
```env
# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# API Configuration
API_PREFIX=/api
API_VERSION=v1
```

### **Database Configuration**
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/mfulearnai
MONGODB_OPTIONS=retryWrites=true&w=majority

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# ChromaDB
CHROMADB_URL=http://localhost:8000
CHROMADB_API_KEY=your-chromadb-key
```

### **Authentication**
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=15m

# SAML Configuration
SAML_SP_ENTITY_ID=https://your-domain.com/saml/metadata
SAML_IDP_ENTITY_ID=https://your-idp.com/metadata
SAML_IDP_SSO_URL=https://your-idp.com/sso
SAML_IDP_SLO_URL=https://your-idp.com/slo
SAML_CERTIFICATE=LS0tLS1CRUdJTi... (base64 encoded)
```

### **AWS Services**
```env
# AWS Bedrock
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_BEDROCK_ENDPOINT=https://bedrock-runtime.us-east-1.amazonaws.com
```

---

## 🔧 **Environment File Templates**

### **Production (.env.production)**
```env
# Application
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://mfulearnai.mfu.ac.th

# Database
MONGODB_URI=mongodb://mongo-cluster:27017/mfulearnai
REDIS_URL=redis://redis-server:6379
CHROMADB_URL=http://chromadb-server:8000

# Security
JWT_SECRET=your-production-jwt-secret-key
SAML_SP_ENTITY_ID=https://mfulearnai.mfu.ac.th/saml/metadata
SAML_IDP_ENTITY_ID=https://idp.mfu.ac.th/metadata
SAML_IDP_SSO_URL=https://idp.mfu.ac.th/sso
SAML_IDP_SLO_URL=https://idp.mfu.ac.th/slo
SAML_CERTIFICATE=your-production-certificate

# AWS
AWS_ACCESS_KEY_ID=your-production-access-key
AWS_SECRET_ACCESS_KEY=your-production-secret-key
AWS_REGION=us-east-1
```

### **Development (.env.development)**
```env
# Application
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/mfulearnai-dev
REDIS_URL=redis://localhost:6379
CHROMADB_URL=http://localhost:8000

# Security
JWT_SECRET=dev-jwt-secret-key
SAML_SP_ENTITY_ID=http://localhost:5000/saml/metadata
SAML_IDP_ENTITY_ID=http://localhost:8080/metadata
SAML_IDP_SSO_URL=http://localhost:8080/sso
SAML_IDP_SLO_URL=http://localhost:8080/slo
SAML_CERTIFICATE=dev-certificate

# AWS
AWS_ACCESS_KEY_ID=dev-access-key
AWS_SECRET_ACCESS_KEY=dev-secret-key
AWS_REGION=us-east-1
```

---

## ⚠️ **Security Considerations**

### **Sensitive Data Protection**
```bash
# Never commit .env files
echo ".env*" >> .gitignore

# Use environment-specific files
.env.production
.env.staging
.env.development
```

### **Secret Management**
```bash
# Use AWS Secrets Manager (recommended)
AWS_SECRET_MANAGER_REGION=us-east-1
AWS_SECRET_MANAGER_SECRET_NAME=mfu-backend-secrets

# Or use HashiCorp Vault
VAULT_ADDR=https://vault.your-domain.com
VAULT_TOKEN=your-vault-token
```

---

## 🔄 **Migration from FastAPI**

### **Environment Variable Mapping**
| **FastAPI** | **NestJS** | **Notes** |
|-------------|------------|-----------|
| `DATABASE_URL` | `MONGODB_URI` | Same value |
| `REDIS_URL` | `REDIS_URL` | Same value |
| `JWT_SECRET` | `JWT_SECRET` | Same value |
| `FRONTEND_URL` | `FRONTEND_URL` | Same value |
| `SAML_*` | `SAML_*` | Same values |
| `AWS_*` | `AWS_*` | Same values |

### **Migration Script**
```bash
#!/bin/bash
# migrate-env.sh

# Backup existing environment
cp .env .env.backup

# Copy FastAPI environment
cp ../backend/.env .env.temp

# Update port configuration
sed -i 's/PORT=8000/PORT=5000/g' .env.temp

# Rename to NestJS environment
mv .env.temp .env

echo "Environment migrated successfully!"
```

---

## 🔍 **Environment Validation**

### **Validation Script**
```bash
#!/bin/bash
# validate-env.sh

echo "🔍 Validating environment configuration..."

# Check required variables
required_vars=(
  "PORT"
  "NODE_ENV"
  "MONGODB_URI"
  "REDIS_URL"
  "JWT_SECRET"
  "FRONTEND_URL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

# Test database connections
echo "🔍 Testing database connections..."

# Test MongoDB
if mongosh "$MONGODB_URI" --eval "db.runCommand('ping')" > /dev/null 2>&1; then
  echo "✅ MongoDB connection successful"
else
  echo "❌ MongoDB connection failed"
fi

# Test Redis
if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
  echo "✅ Redis connection successful"
else
  echo "❌ Redis connection failed"
fi

echo "✅ Environment validation complete!"
```

---

## 🚀 **Deployment-Specific Configuration**

### **Docker Environment**
```env
# Docker-specific overrides
MONGODB_URI=mongodb://mongodb:27017/mfulearnai
REDIS_URL=redis://redis:6379
CHROMADB_URL=http://chromadb:8000

# Use Docker secrets
JWT_SECRET_FILE=/run/secrets/jwt_secret
AWS_ACCESS_KEY_ID_FILE=/run/secrets/aws_access_key
```

### **Kubernetes Environment**
```yaml
# k8s-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mfu-backend-config
data:
  PORT: "5000"
  NODE_ENV: "production"
  FRONTEND_URL: "https://mfulearnai.mfu.ac.th"
  MONGODB_URI: "mongodb://mongodb-service:27017/mfulearnai"
  REDIS_URL: "redis://redis-service:6379"
  CHROMADB_URL: "http://chromadb-service:8000"
```

---

## 📊 **Environment Monitoring**

### **Health Check Configuration**
```env
# Health check settings
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_RETRIES=3

# Database health check
DB_HEALTH_CHECK_ENABLED=true
REDIS_HEALTH_CHECK_ENABLED=true
CHROMADB_HEALTH_CHECK_ENABLED=true
```

### **Logging Configuration**
```env
# Logging settings
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_FILE_PATH=logs/application.log
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5
```

---

## 🛠️ **Quick Setup Commands**

### **Initialize Environment**
```bash
# Create environment file
npm run env:create

# Copy template
cp .env.example .env

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Validate configuration
npm run env:validate
```

### **Environment Switching**
```bash
# Switch to development
npm run env:dev

# Switch to production
npm run env:prod

# Switch to staging
npm run env:staging
```

---

**🌐 Environment Setup Complete!**

Your NestJS backend is now configured with all necessary environment variables for production deployment. 