# Department Service

Microservice for managing departments in MFU Learn AI system.

## Features

- Department CRUD operations
- User count tracking per department
- Department statistics and analytics
- Event handlers for user lifecycle (create, delete, department change)
- Auto-scaling with HPA
- Health and readiness checks

## API Endpoints

### Department Management
- `GET /api/departments` - Get all departments
- `GET /api/departments/stats` - Get department statistics
- `GET /api/departments/:id` - Get department by ID
- `POST /api/departments` - Create new department
- `POST /api/departments/ensure` - Find or create department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Soft delete department
- `POST /api/departments/recalculate` - Recalculate all user counts

### Event Handlers (Internal)
- `POST /api/departments/events/user-created` - Handle user creation
- `POST /api/departments/events/user-deleted` - Handle user deletion
- `POST /api/departments/events/user-department-changed` - Handle department change

### Health Checks
- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe

## Environment Variables

- `NODE_ENV` - Environment (production/development)
- `PORT` - Service port (default: 3002)
- `LOG_LEVEL` - Logging level
- `MONGODB_URI` - MongoDB connection string

## Deployment

### Build and Deploy
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment
```bash
# Build image
docker build -t mfulearnai/department-service:latest .

# Load into kind
kind load docker-image mfulearnai/department-service:latest --name mfulearnai

# Apply manifests
kubectl apply -f k8s/
```

### Test Deployment
```bash
# Check pods
kubectl get pods -l app=department-service

# Port forward
kubectl port-forward svc/department-service 3002:3002

# Test health endpoint
curl http://localhost:3002/health

# Test API
curl http://localhost:3002/api/departments
```

## Architecture

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Container**: Docker multi-stage build
- **Orchestration**: Kubernetes
- **Scaling**: HPA (2-5 replicas)

## Resource Limits

- **Requests**: 128Mi RAM, 100m CPU
- **Limits**: 256Mi RAM, 200m CPU
- **Replicas**: 2-5 (auto-scaling)

## Service Communication

Other services can call department service via:
- Internal: `http://department-service:3002/api/departments`
- Within K8s cluster: `department-service.default.svc.cluster.local:3002`
