# 🚀 Deployment Instructions for Remote Server

## Step-by-Step Deployment Guide

### Prerequisites
- SSH access to `mfulearnai@10.1.44.204`
- Kubernetes cluster is running
- kubectl is configured
- Docker is installed

---

## 🔧 Step 1: SSH to Remote Server

```bash
ssh mfulearnai@10.1.44.204
```

---

## 📥 Step 2: Pull Latest Code

```bash
cd ~/MFULearnAi  # Or your project path
git pull origin kubernetes
```

---

## 🏗️ Step 3: Run Deployment Script

The deployment script will:
1. Build all 9 Docker images
2. Create Kubernetes namespaces
3. Deploy infrastructure (MongoDB, Redis, ChromaDB, MinIO)
4. Deploy all microservices
5. Deploy API Gateway
6. Deploy Ingress
7. Deploy monitoring stack

### Run the script:

```bash
cd k8s
chmod +x deploy-all-services.sh
./deploy-all-services.sh
```

---

## 📊 Step 4: Monitor Deployment Progress

### Watch pods come online:

```bash
# Watch all pods
watch kubectl get pods --all-namespaces | grep mfulearnai

# Or check specific namespace
kubectl get pods -n mfulearnai-services
kubectl get pods -n mfulearnai-core
kubectl get pods -n mfulearnai-gateway
```

### Check pod logs:

```bash
# API Gateway
kubectl logs -f deployment/api-gateway -n mfulearnai-gateway

# Chat Service
kubectl logs -f deployment/chat-service -n mfulearnai-services

# Auth Service
kubectl logs -f deployment/auth-service -n mfulearnai-services

# Department Service
kubectl logs -f deployment/department-service -n mfulearnai-services
```

---

## ✅ Step 5: Verify All Services Are Running

### Check all pods:

```bash
kubectl get pods -n mfulearnai-core
kubectl get pods -n mfulearnai-services
kubectl get pods -n mfulearnai-gateway
kubectl get pods -n mfulearnai-monitoring
```

### Check services:

```bash
kubectl get svc -n mfulearnai-services
kubectl get svc -n mfulearnai-gateway
```

### Check ingress:

```bash
kubectl get ingress -n mfulearnai-gateway
```

---

## 🧪 Step 6: Test Services

### Test API Gateway health:

```bash
# From inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://api-gateway.mfulearnai-gateway.svc.cluster.local:8080/health

# From outside (if ingress is configured)
curl https://mfulearnai.mfu.ac.th/health
```

### Test individual services:

```bash
# Auth Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://auth-service.mfulearnai-services.svc.cluster.local:3000/health

# Department Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://department-service.mfulearnai-services.svc.cluster.local:3001/health

# Chat Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://chat-service.mfulearnai-services.svc.cluster.local:3002/health

# Storage Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://storage-service.mfulearnai-services.svc.cluster.local:3006/health

# RAG Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://rag-service.mfulearnai-services.svc.cluster.local:3004/health

# Agent Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://agent-service.mfulearnai-services.svc.cluster.local:3003/health

# Training Service
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://training-service.mfulearnai-services.svc.cluster.local:3005/health
```

---

## 🐛 Troubleshooting

### If a pod fails to start:

```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace>

# Check previous logs if pod restarted
kubectl logs <pod-name> -n <namespace> --previous
```

### If image pull fails:

```bash
# Verify image exists
docker images | grep mfulearnai

# Re-build specific service
cd k8s/services/<service-name>
docker build -t mfulearnai/<service-name>:v1.0.0 .
```

### If service can't connect to MongoDB:

```bash
# Check MongoDB is running
kubectl get pods -n mfulearnai-core -l app=mongodb

# Check MongoDB service
kubectl get svc -n mfulearnai-core -l app=mongodb

# Test DNS resolution
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- \
  nslookup mongodb.mfulearnai-core.svc.cluster.local
```

### If WebSocket connections fail:

```bash
# Check ingress annotations for WebSocket
kubectl describe ingress mfulearnai-ingress -n mfulearnai-gateway

# Should have:
# nginx.ingress.kubernetes.io/websocket-services: chat-service
```

---

## 🔄 Update a Single Service

If you need to update just one service:

```bash
# Example: Update Chat Service
cd k8s/services/chat-service

# Rebuild image
docker build -t mfulearnai/chat-service:v1.0.1 .

# Update deployment
kubectl set image deployment/chat-service \
  chat-service=mfulearnai/chat-service:v1.0.1 \
  -n mfulearnai-services

# Or rollout restart
kubectl rollout restart deployment/chat-service -n mfulearnai-services

# Watch rollout
kubectl rollout status deployment/chat-service -n mfulearnai-services
```

---

## 🗑️ Clean Up (if needed)

To remove everything:

```bash
# Delete all resources
kubectl delete namespace mfulearnai-core
kubectl delete namespace mfulearnai-services
kubectl delete namespace mfulearnai-gateway
kubectl delete namespace mfulearnai-monitoring

# Or use undeploy script if available
cd k8s
./undeploy.sh --all
```

---

## 📋 Service URLs (Internal)

After deployment, services are available at:

| Service | Internal URL | Port |
|---------|--------------|------|
| API Gateway | `http://api-gateway.mfulearnai-gateway.svc.cluster.local` | 8080 |
| Auth Service | `http://auth-service.mfulearnai-services.svc.cluster.local` | 3000 |
| Department Service | `http://department-service.mfulearnai-services.svc.cluster.local` | 3001 |
| Chat Service | `http://chat-service.mfulearnai-services.svc.cluster.local` | 3002 |
| Agent Service | `http://agent-service.mfulearnai-services.svc.cluster.local` | 3003 |
| RAG Service | `http://rag-service.mfulearnai-services.svc.cluster.local` | 3004 |
| Training Service | `http://training-service.mfulearnai-services.svc.cluster.local` | 3005 |
| Storage Service | `http://storage-service.mfulearnai-services.svc.cluster.local` | 3006 |
| Bedrock Gateway | `http://bedrock-gateway.mfulearnai-services.svc.cluster.local` | 8000 |
| MongoDB | `mongodb://mongodb.mfulearnai-core.svc.cluster.local` | 27017 |
| Redis | `redis://redis.mfulearnai-core.svc.cluster.local` | 6379 |
| ChromaDB | `http://chromadb.mfulearnai-core.svc.cluster.local` | 8000 |
| MinIO | `http://minio.mfulearnai-core.svc.cluster.local` | 9000 |

---

## 🌐 External Access

If Ingress is configured:
- **Frontend**: https://mfulearnai.mfu.ac.th
- **API**: https://mfulearnai.mfu.ac.th/api/*
- **WebSocket**: wss://mfulearnai.mfu.ac.th/ws

---

## 📞 Support

For issues, check:
1. Pod logs: `kubectl logs -f <pod-name> -n <namespace>`
2. Pod events: `kubectl describe pod <pod-name> -n <namespace>`
3. Service endpoints: `kubectl get endpoints -n <namespace>`
4. Ingress status: `kubectl describe ingress -n mfulearnai-gateway`

---

**Happy Deploying! 🚀**
