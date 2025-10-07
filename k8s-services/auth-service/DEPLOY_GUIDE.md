# Auth Service Deployment Guide

## 🚀 Quick Start for Production Server

### Step 1: Local Development (on your machine)

```bash
# Commit and push the code
git add .
git commit -m "Add Auth Service microservice with production config"
git push origin bedrock
```

### Step 2: Deploy on Server (SSH to 10.1.44.204)

```bash
# SSH to production server
ssh mfulearnai@10.1.44.204

# Navigate to project directory
cd /path/to/MFULearnAi

# Pull latest code
git pull origin bedrock

# Navigate to auth service
cd k8s-services/auth-service

# Verify files exist
ls -la
ls -la k8s/

# The .env and k8s/secret.yaml files are already configured with production values!
# No need to edit them manually.
```

### Step 3: Build Docker Image

```bash
# Build the Docker image
docker build -t mfulearnai/auth-service:latest .

# Verify image was built
docker images | grep auth-service
```

### Step 4: Deploy to Kubernetes

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### Step 5: Verify Deployment

```bash
# Check pods
kubectl get pods -n mfulearnai -l app=auth-service

# Check service
kubectl get svc -n mfulearnai auth-service

# View logs
kubectl logs -n mfulearnai -l app=auth-service --tail=50 -f

# Test health endpoint (port-forward)
kubectl port-forward -n mfulearnai svc/auth-service 3001:3001
# In another terminal:
curl http://localhost:3001/health
```

## 📋 Expected Output

### Successful Deployment
```
✅ Auth Service deployed successfully!
========================================
To view logs: kubectl logs -n mfulearnai -l app=auth-service -f
To port-forward: kubectl port-forward -n mfulearnai svc/auth-service 3001:3001
```

### Healthy Pods
```bash
$ kubectl get pods -n mfulearnai -l app=auth-service
NAME                            READY   STATUS    RESTARTS   AGE
auth-service-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
auth-service-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
```

### Health Check Response
```json
{
  "status": "healthy",
  "service": "auth-service",
  "timestamp": "2025-10-07T..."
}
```

## 🔧 Configuration Details

### Environment Variables (Already Set)
All configuration is already set in `.env` file with production values:
- ✅ MongoDB URI: `mongodb://root:1234@mongodb:27017/mfu_chatbot?authSource=admin`
- ✅ JWT Secret: Production secret from root .env
- ✅ SAML IDP URLs: `https://authsso.mfu.ac.th/adfs/ls/`
- ✅ SAML Certificate: Production certificate
- ✅ Frontend URL: `https://mfulearnai.mfu.ac.th`

### Kubernetes Resources (Already Configured)
- ✅ ConfigMap: `k8s/configmap.yaml`
- ✅ Secret: `k8s/secret.yaml` (with real values)
- ✅ Deployment: 2 replicas with auto-scaling
- ✅ Service: ClusterIP on port 3001
- ✅ HPA: Scale 2-10 pods based on CPU/Memory

## 🔍 Troubleshooting

### Issue: Pods not starting

```bash
# Check pod status
kubectl describe pod -n mfulearnai -l app=auth-service

# Check events
kubectl get events -n mfulearnai --sort-by='.lastTimestamp'

# Check logs for errors
kubectl logs -n mfulearnai -l app=auth-service --tail=100
```

### Issue: MongoDB connection failed

```bash
# Check if MongoDB service exists
kubectl get svc -n mfulearnai mongodb

# Check MongoDB pods
kubectl get pods -n mfulearnai -l app=mongodb

# Test connection from auth-service pod
kubectl exec -it <auth-service-pod> -n mfulearnai -- sh
# Inside pod:
nc -zv mongodb 27017
```

### Issue: Health check failing

```bash
# Port forward to test locally
kubectl port-forward -n mfulearnai svc/auth-service 3001:3001

# Test health endpoint
curl http://localhost:3001/health

# Check if service is listening
kubectl exec -it <auth-service-pod> -n mfulearnai -- sh
# Inside pod:
netstat -tlnp | grep 3001
```

## 🔄 Updating the Service

```bash
# On local machine: make changes and push
git add .
git commit -m "Update auth service"
git push origin bedrock

# On server: pull and redeploy
ssh mfulearnai@10.1.44.204
cd /path/to/MFULearnAi
git pull origin bedrock
cd k8s-services/auth-service

# Rebuild image with new tag
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker build -t mfulearnai/auth-service:$TIMESTAMP .
docker tag mfulearnai/auth-service:$TIMESTAMP mfulearnai/auth-service:latest

# Update deployment
kubectl rollout restart deployment/auth-service -n mfulearnai

# Watch rollout
kubectl rollout status deployment/auth-service -n mfulearnai
```

## 📊 Monitoring

### View Logs
```bash
# Real-time logs
kubectl logs -n mfulearnai -l app=auth-service -f

# Last 100 lines
kubectl logs -n mfulearnai -l app=auth-service --tail=100

# Logs from specific pod
kubectl logs -n mfulearnai <pod-name>
```

### Check Resources
```bash
# CPU and Memory usage
kubectl top pods -n mfulearnai -l app=auth-service

# HPA status
kubectl get hpa -n mfulearnai auth-service-hpa
```

### Test Endpoints
```bash
# Port forward
kubectl port-forward -n mfulearnai svc/auth-service 3001:3001

# Test health
curl http://localhost:3001/health

# Test service info
curl http://localhost:3001/

# Test SAML metadata
curl http://localhost:3001/api/auth/metadata
```

## 🗑️ Uninstalling

```bash
# Delete all auth service resources
kubectl delete -f k8s/deployment.yaml
kubectl delete -f k8s/configmap.yaml
kubectl delete -f k8s/secret.yaml
kubectl delete -f k8s/hpa.yaml

# Or delete by label
kubectl delete all -n mfulearnai -l app=auth-service
kubectl delete configmap -n mfulearnai auth-service-config
kubectl delete secret -n mfulearnai auth-service-secrets
kubectl delete hpa -n mfulearnai auth-service-hpa
```

## ✅ Next Steps

After successfully deploying Auth Service:

1. **Test SAML Login Flow**
   - Navigate to `https://mfulearnai.mfu.ac.th/api/auth/login/saml`
   - Complete authentication
   - Verify JWT token is generated

2. **Test Admin Login**
   - POST to `/api/auth/admin/login` with username/password
   - Verify token is returned

3. **Test Token Validation**
   - GET `/api/auth/me` with Bearer token
   - Verify user info is returned

4. **Deploy Next Service**
   - Department Service (manages department data)
   - Chat Service (handles WebSocket & chat)
   - RAG Service (vector search & embeddings)

## 📝 Notes

- ⚠️ MongoDB must be running in the cluster before deploying auth-service
- ⚠️ The service uses the same MongoDB as Docker Compose deployment
- ⚠️ JWT tokens are compatible with existing backend
- ⚠️ SAML configuration matches existing production setup
- ✅ No frontend changes required - API is backward compatible
