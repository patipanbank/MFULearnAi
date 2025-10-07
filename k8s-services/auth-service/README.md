# Auth Service - MFULearnAI

Authentication microservice for MFULearnAI K8s deployment.

## Features

- ✅ SAML 2.0 Authentication (SSO)
- ✅ JWT Token Generation & Validation
- ✅ Admin Username/Password Login
- ✅ User Management
- ✅ Department Integration
- ✅ Role-Based Access Control (RBAC)

## Architecture

This is a standalone microservice that handles all authentication logic:

```
┌─────────────────────────────────────────┐
│          Auth Service (Port 3001)       │
│  ┌────────────────────────────────────┐ │
│  │  SAML Authentication               │ │
│  │  - Login/Logout                    │ │
│  │  - Callback Handling               │ │
│  │  - Metadata Generation             │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  JWT Token Management              │ │
│  │  - Token Generation                │ │
│  │  - Token Validation                │ │
│  │  - Token Refresh                   │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Admin Authentication              │ │
│  │  - Username/Password Login         │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
           │                    │
           ↓                    ↓
      ┌─────────┐      ┌──────────────────┐
      │ MongoDB │      │ Department Service│
      └─────────┘      └──────────────────┘
```

## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /` - Service info

### Authentication Endpoints
- `POST /api/auth/admin/login` - Admin login with username/password
- `GET /api/auth/login/saml` - Initiate SAML login
- `POST /api/auth/saml/callback` - SAML callback (POST)
- `GET /api/auth/saml/callback` - SAML callback (GET)
- `GET /api/auth/metadata` - SAML metadata
- `GET /api/auth/me` - Get current user (requires JWT)
- `POST /api/auth/refresh` - Refresh JWT token (requires JWT)
- `GET /api/auth/logout` - Simple logout
- `GET /api/auth/logout/saml` - SAML logout
- `POST /api/auth/logout/saml/callback` - SAML logout callback (POST)
- `GET /api/auth/logout/saml/callback` - SAML logout callback (GET)
- `GET /api/auth/logout/saml/manual` - Manual SAML logout return

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

### Required Variables
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT signing
- `SAML_SP_ENTITY_ID` - Service Provider Entity ID
- `SAML_IDP_SSO_URL` - Identity Provider SSO URL
- `SAML_CERTIFICATE` - IDP Certificate for SAML validation

## Development

### Prerequisites
- Node.js 20+
- MongoDB
- TypeScript

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run in development mode
npm run dev

# Build
npm run build

# Run production
npm start
```

## Docker Build

```bash
# Build image
docker build -t mfulearnai/auth-service:latest .

# Run container
docker run -p 3001:3001 \
  --env-file .env \
  mfulearnai/auth-service:latest
```

## Kubernetes Deployment

### Prerequisites
1. K8s cluster running
2. kubectl configured
3. Namespace created

### Deploy to K8s

```bash
# Create namespace (if not exists)
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap
kubectl apply -f k8s/configmap.yaml

# Create Secret (copy from example and edit first!)
cp k8s/secret.yaml.example k8s/secret.yaml
# Edit k8s/secret.yaml with real values
kubectl apply -f k8s/secret.yaml

# Deploy service
kubectl apply -f k8s/deployment.yaml

# Enable autoscaling
kubectl apply -f k8s/hpa.yaml

# Check deployment
kubectl get pods -n mfulearnai -l app=auth-service
kubectl logs -n mfulearnai -l app=auth-service --tail=50 -f

# Check service
kubectl get svc -n mfulearnai auth-service
```

### Verify Deployment

```bash
# Port forward for testing
kubectl port-forward -n mfulearnai svc/auth-service 3001:3001

# Test health endpoint
curl http://localhost:3001/health

# Expected response:
# {"status":"healthy","service":"auth-service","timestamp":"..."}
```

## Dependencies

### External Services
- **MongoDB**: User data storage
- **Department Service** (optional): Department management integration

### Libraries
- `express` - Web framework
- `passport-saml` - SAML 2.0 authentication
- `jsonwebtoken` - JWT token handling
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit real secrets** to Git
2. Use K8s Secrets for sensitive data
3. Rotate JWT secrets regularly
4. Use HTTPS in production
5. Validate all SAML assertions
6. Implement rate limiting (via API Gateway)
7. Monitor authentication attempts
8. Use strong session secrets

## Migration from Monolith

This service is a **1:1 copy** of the auth functionality from the main backend, ensuring:
- ✅ Same SAML configuration
- ✅ Same JWT token format
- ✅ Same user model
- ✅ Same role mapping logic
- ✅ Same API responses

**No changes required** to existing frontend or other services.

## Monitoring

### Health Check
```bash
curl http://auth-service:3001/health
```

### Logs
```bash
kubectl logs -n mfulearnai -l app=auth-service --tail=100 -f
```

### Metrics
- Use Prometheus to scrape `/metrics` endpoint (if added)
- Monitor JWT token generation rate
- Monitor SAML authentication failures
- Monitor API response times

## Troubleshooting

### Common Issues

**1. MongoDB Connection Failed**
```bash
# Check MongoDB service
kubectl get pods -n mfulearnai -l app=mongodb

# Check connection string in secret
kubectl get secret -n mfulearnai auth-service-secrets -o yaml
```

**2. SAML Authentication Failed**
```bash
# Check SAML configuration
kubectl logs -n mfulearnai -l app=auth-service | grep SAML

# Verify IDP certificate
kubectl get secret -n mfulearnai auth-service-secrets -o jsonpath='{.data.saml-certificate}' | base64 -d
```

**3. JWT Token Invalid**
```bash
# Verify JWT secret matches across services
kubectl get secret -n mfulearnai auth-service-secrets -o jsonpath='{.data.jwt-secret}' | base64 -d
```

## Testing

### Test SAML Login Flow
1. Navigate to: `https://mfulearnai.mfu.ac.th/api/auth/login/saml`
2. Complete IDP authentication
3. Verify redirect to `/auth/callback?token=...`
4. Verify token is valid JWT

### Test Admin Login
```bash
curl -X POST http://localhost:3001/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

### Test Token Validation
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## License

Internal use only - MFU LearnAI Project
