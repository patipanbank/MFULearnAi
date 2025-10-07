# K8s Microservices - MFULearnAI

This directory contains microservices designed for Kubernetes deployment.

## Overview

We are migrating from Docker Compose monolith to K8s microservices architecture.

### Migration Strategy

1. **Create new services** (not moving existing files)
2. **Deploy incrementally** - one service at a time
3. **Maintain backward compatibility** - existing system must continue to work
4. **Test on production server** via SSH (mfulearnai@10.1.44.204)

## Services

### ✅ Auth Service (Completed)
- **Status**: Ready for deployment
- **Port**: 3001
- **Description**: SAML authentication, JWT token management, user management
- **Documentation**: [auth-service/README.md](auth-service/README.md)

### 🔄 Planned Services

1. **Department Service** (Next) - Department management
2. **Chat Service** - Chat & WebSocket handling
3. **Agent Service** - AI Agent execution & orchestration
4. **RAG Service** - Vector search, embedding, document processing
5. **Training Service** - Document upload & training
6. **Admin Service** - Admin panel, usage analytics, monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NGINX Ingress Controller              │
│          (Load Balancer & Reverse Proxy)                │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼─────────┐                  ┌─────────▼─────────┐
│  Auth Service   │                  │  Other Services   │
│   (Port 3001)   │◄────────────────►│   (Port 300X)     │
└────────┬────────┘                  └──────────┬────────┘
         │                                      │
         │         Shared Infrastructure        │
         └──────────────┬──────────────────────┘
                        │
        ┌───────────────┼───────────────────┐
        │               │                   │
┌───────▼──────┐ ┌──────▼──────┐ ┌────────▼────────┐
│   MongoDB    │ │    Redis    │ │    ChromaDB     │
│ (StatefulSet)│ │(StatefulSet)│ │  (StatefulSet)  │
└──────────────┘ └─────────────┘ └─────────────────┘
```

## Deployment Process

### Prerequisites
1. K8s cluster available on 10.1.44.204
2. kubectl configured and working
3. Docker installed
4. Git repository cloned

### General Deployment Steps

For each service:

1. **Development** (Local)
   ```bash
   cd k8s-services/<service-name>
   npm install
   npm run dev
   ```

2. **Build & Test** (Local)
   ```bash
   npm run build
   docker build -t mfulearnai/<service-name>:latest .
   docker run -p <port>:<port> --env-file .env mfulearnai/<service-name>:latest
   ```

3. **Git Commit** (Local)
   ```bash
   git add k8s-services/<service-name>
   git commit -m "Add <service-name> microservice"
   git push origin <branch>
   ```

4. **Pull on Server** (SSH)
   ```bash
   ssh mfulearnai@10.1.44.204
   cd /path/to/MFULearnAi
   git pull origin <branch>
   ```

5. **Deploy to K8s** (SSH on server)
   ```bash
   cd k8s-services/<service-name>

   # Setup secrets
   cp k8s/secret.yaml.example k8s/secret.yaml
   # Edit with real values
   nano k8s/secret.yaml

   # Run deployment script
   chmod +x deploy.sh
   ./deploy.sh
   ```

6. **Verify Deployment**
   ```bash
   kubectl get pods -n mfulearnai
   kubectl logs -n mfulearnai -l app=<service-name> -f
   kubectl port-forward -n mfulearnai svc/<service-name> <port>:<port>
   curl http://localhost:<port>/health
   ```

## Directory Structure

```
k8s-services/
├── README.md                 # This file
├── auth-service/             # Auth microservice
│   ├── src/                  # Source code
│   ├── k8s/                  # K8s manifests
│   ├── Dockerfile            # Docker build
│   ├── package.json          # Dependencies
│   ├── deploy.sh             # Deployment script
│   └── README.md             # Service documentation
├── department-service/       # Department microservice (planned)
├── chat-service/             # Chat microservice (planned)
└── ...
```

## Best Practices

### Code
- ✅ TypeScript for type safety
- ✅ Environment-based configuration
- ✅ Structured logging
- ✅ Error handling middleware
- ✅ Health check endpoints

### Docker
- ✅ Multi-stage builds for smaller images
- ✅ Non-root user for security
- ✅ Health checks in Dockerfile
- ✅ .dockerignore for faster builds

### Kubernetes
- ✅ Resource limits & requests
- ✅ Liveness & readiness probes
- ✅ ConfigMaps for configuration
- ✅ Secrets for sensitive data
- ✅ HPA for auto-scaling
- ✅ Proper labels & annotations

### Security
- ✅ Never commit secrets to Git
- ✅ Use K8s Secrets for sensitive data
- ✅ Rotate secrets regularly
- ✅ Use HTTPS in production
- ✅ Implement RBAC
- ✅ Network policies for isolation

## Monitoring

### Logs
```bash
# All services
kubectl logs -n mfulearnai -l tier=backend --tail=100 -f

# Specific service
kubectl logs -n mfulearnai -l app=auth-service --tail=100 -f
```

### Metrics
```bash
# Pods
kubectl get pods -n mfulearnai

# Services
kubectl get svc -n mfulearnai

# HPA
kubectl get hpa -n mfulearnai

# Resources
kubectl top pods -n mfulearnai
kubectl top nodes
```

### Troubleshooting
```bash
# Describe pod
kubectl describe pod <pod-name> -n mfulearnai

# Exec into pod
kubectl exec -it <pod-name> -n mfulearnai -- /bin/sh

# Events
kubectl get events -n mfulearnai --sort-by='.lastTimestamp'
```

## Rollback

If deployment fails:

```bash
# Rollback to previous version
kubectl rollout undo deployment/<service-name> -n mfulearnai

# Check rollout history
kubectl rollout history deployment/<service-name> -n mfulearnai

# Rollback to specific revision
kubectl rollout undo deployment/<service-name> -n mfulearnai --to-revision=<number>
```

## CI/CD (Future)

Planned integration with:
- **GitLab CI/CD** or **GitHub Actions**
- **ArgoCD** for GitOps
- **Helm** for package management
- **Kustomize** for environment-specific configs

## Notes

⚠️ **Important Reminders**:
1. We develop locally, commit to Git, then pull on server (10.1.44.204)
2. We cannot test Docker locally - must deploy to server
3. Each service is NEW code, not moved from existing backend
4. Maintain backward compatibility with existing system
5. Test thoroughly before marking service as complete

## Support

For issues or questions:
1. Check service-specific README
2. Review K8s logs
3. Check K8s events
4. Contact DevOps team
