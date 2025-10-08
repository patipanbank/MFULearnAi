# 🚀 Complete Deployment Guide - MFULearnAI Kubernetes

## 📋 Pre-Deployment Checklist

- [ ] SSH access to `mfulearnai@10.1.44.204`
- [ ] Kubernetes cluster running
- [ ] kubectl configured
- [ ] Docker installed
- [ ] Git repository access
- [ ] AWS credentials (for Bedrock)
- [ ] SAML certificate (if using SAML)

---

## 🎯 Deployment Strategy

**RECOMMENDED**: Full Kubernetes deployment (replace Docker Compose entirely)

### Why?
✅ No port conflicts
✅ Proper microservices architecture
✅ Horizontal auto-scaling
✅ Self-healing with health probes
✅ Service discovery via DNS
✅ Production-ready monitoring

---

## 📦 Step-by-Step Deployment

### Step 1: SSH to Remote Server

```bash
ssh mfulearnai@10.1.44.204
```

### Step 2: Backup Existing Data (if migrating from Docker Compose)

```bash
# Backup MongoDB data
docker-compose exec db mongodump --out=/tmp/mongodb-backup

# Backup MinIO data (if needed)
docker-compose exec minio mc mirror /data /tmp/minio-backup

# Copy backups to safe location
sudo cp -r /tmp/mongodb-backup ~/backups/mongodb-$(date +%Y%m%d)
sudo cp -r /tmp/minio-backup ~/backups/minio-$(date +%Y%m%d)
```

### Step 3: Stop Docker Compose (to avoid port conflicts)

```bash
cd ~/MFULearnAi  # Or your project path
docker-compose down
```

### Step 4: Pull Latest Code

```bash
cd ~/MFULearnAi
git fetch origin
git checkout kubernetes
git pull origin kubernetes
```

### Step 5: Review Port Analysis

```bash
cat PORT_ANALYSIS.md
```

### Step 6: Create Kubernetes Secrets

#### Method A: From template (Recommended)

```bash
cd k8s

# Copy template
cp secrets-template.yaml secrets.yaml

# Edit with your actual values
nano secrets.yaml  # or vim/vi

# Apply secrets
kubectl apply -f secrets.yaml

# Verify
kubectl get secrets -n mfulearnai-core
kubectl get secrets -n mfulearnai-services
kubectl get secrets -n mfulearnai-gateway
```

#### Method B: Create secrets directly (Quick)

```bash
# MongoDB Secret
kubectl create secret generic mongodb-secret \
  --from-literal=mongodb-uri='mongodb://root:your-password@mongodb.mfulearnai-core.svc.cluster.local:27017/mfu_chatbot?authSource=admin' \
  --from-literal=mongodb-root-password='your-password' \
  -n mfulearnai-core

# AWS Credentials (for Bedrock, Agent, Training services)
kubectl create secret generic aws-secret \
  --from-literal=aws-access-key-id='YOUR_AWS_KEY' \
  --from-literal=aws-secret-access-key='YOUR_AWS_SECRET' \
  --from-literal=aws-region='us-east-1' \
  -n mfulearnai-services

# Auth Service Secret
kubectl create secret generic auth-service-secret \
  --from-literal=jwt-secret='your-super-secret-jwt-key-min-32-chars' \
  --from-literal=session-secret='your-session-secret-min-32-chars' \
  -n mfulearnai-services

# Storage Service Secret (MinIO)
kubectl create secret generic storage-service-secret \
  --from-literal=s3-access-key='minioadmin' \
  --from-literal=s3-secret-key='minioadmin123' \
  -n mfulearnai-services

# API Gateway Secret (must match auth-service JWT secret)
kubectl create secret generic api-gateway-secret \
  --from-literal=jwt-secret='your-super-secret-jwt-key-min-32-chars' \
  -n mfulearnai-gateway
```

### Step 7: Run Deployment Script

```bash
cd k8s
chmod +x deploy-all-services.sh
./deploy-all-services.sh
```

The script will:
1. ✅ Build all 9 Docker images
2. ✅ Create Kubernetes namespaces
3. ✅ Deploy infrastructure (MongoDB, Redis, ChromaDB, MinIO)
4. ✅ Deploy all microservices
5. ✅ Deploy API Gateway
6. ✅ Deploy Ingress
7. ✅ Deploy monitoring stack

### Step 8: Monitor Deployment Progress

```bash
# Watch all pods
watch kubectl get pods --all-namespaces | grep mfulearnai

# Or specific namespaces
kubectl get pods -n mfulearnai-core
kubectl get pods -n mfulearnai-services
kubectl get pods -n mfulearnai-gateway
kubectl get pods -n mfulearnai-monitoring
```

### Step 9: Wait for All Pods to be Running

```bash
# Core infrastructure
kubectl wait --for=condition=ready pod -l app=mongodb -n mfulearnai-core --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n mfulearnai-core --timeout=300s
kubectl wait --for=condition=ready pod -l app=chromadb -n mfulearnai-core --timeout=300s
kubectl wait --for=condition=ready pod -l app=minio -n mfulearnai-core --timeout=300s

# Services (wait for at least 1 pod per service)
kubectl wait --for=condition=ready pod -l app=auth-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=department-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=chat-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=agent-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=rag-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=training-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=storage-service -n mfulearnai-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=bedrock-gateway -n mfulearnai-services --timeout=300s

# API Gateway
kubectl wait --for=condition=ready pod -l app=api-gateway -n mfulearnai-gateway --timeout=300s
```

### Step 10: Restore Data (if migrating from Docker Compose)

```bash
# Restore MongoDB data
kubectl cp /tmp/mongodb-backup mongodb-0:/tmp/ -n mfulearnai-core
kubectl exec -it mongodb-0 -n mfulearnai-core -- mongorestore /tmp/mongodb-backup

# Restore MinIO data (if needed)
# Upload via MinIO console or mc client
```

---

## ✅ Verification Steps

### 1. Check Pod Status

```bash
# All pods should show Running and READY (e.g., 1/1 or 2/2)
kubectl get pods -n mfulearnai-core
kubectl get pods -n mfulearnai-services
kubectl get pods -n mfulearnai-gateway
```

Expected output:
```
NAME                                   READY   STATUS    RESTARTS   AGE
auth-service-xxxxx-xxxxx              1/1     Running   0          2m
department-service-xxxxx-xxxxx        1/1     Running   0          2m
chat-service-xxxxx-xxxxx              1/1     Running   0          2m
agent-service-xxxxx-xxxxx             1/1     Running   0          2m
rag-service-xxxxx-xxxxx               1/1     Running   0          2m
training-service-xxxxx-xxxxx          1/1     Running   0          2m
storage-service-xxxxx-xxxxx           1/1     Running   0          2m
bedrock-gateway-xxxxx-xxxxx           1/1     Running   0          2m
```

### 2. Check Services

```bash
kubectl get svc -n mfulearnai-services
kubectl get svc -n mfulearnai-gateway
kubectl get svc -n mfulearnai-core
```

### 3. Check Ingress

```bash
kubectl get ingress -n mfulearnai-gateway
kubectl describe ingress mfulearnai-ingress -n mfulearnai-gateway
```

### 4. Test Health Endpoints

```bash
# API Gateway health
kubectl run curl-test --image=curlimages/curl -it --rm --restart=Never -- \
  curl -v http://api-gateway.mfulearnai-gateway.svc.cluster.local:8080/health

# Individual service health checks
kubectl run curl-test --image=curlimages/curl -it --rm --restart=Never -- \
  curl http://auth-service.mfulearnai-services.svc.cluster.local:3000/health

kubectl run curl-test --image=curlimages/curl -it --rm --restart=Never -- \
  curl http://department-service.mfulearnai-services.svc.cluster.local:3001/health

kubectl run curl-test --image=curlimages/curl -it --rm --restart=Never -- \
  curl http://chat-service.mfulearnai-services.svc.cluster.local:3002/health

kubectl run curl-test --image=curlimages/curl -it --rm --restart=Never -- \
  curl http://storage-service.mfulearnai-services.svc.cluster.local:3006/health
```

### 5. Check Service Logs

```bash
# API Gateway
kubectl logs -f deployment/api-gateway -n mfulearnai-gateway

# Chat Service
kubectl logs -f deployment/chat-service -n mfulearnai-services

# Auth Service
kubectl logs -f deployment/auth-service -n mfulearnai-services

# Check for errors
kubectl logs deployment/agent-service -n mfulearnai-services | grep -i error
```

### 6. Test External Access (if Ingress configured)

```bash
# From outside the cluster
curl https://mfulearnai.mfu.ac.th/health
curl https://mfulearnai.mfu.ac.th/api/departments
```

### 7. Monitor Resource Usage

```bash
# CPU and Memory usage
kubectl top pods -n mfulearnai-services
kubectl top pods -n mfulearnai-core

# Check HPA status
kubectl get hpa -n mfulearnai-services
```

---

## 🐛 Troubleshooting Guide

### Pod is in ImagePullBackOff

```bash
# Check image name
kubectl describe pod <pod-name> -n <namespace>

# Re-build image
cd k8s/services/<service-name>
docker build -t mfulearnai/<service-name>:latest .

# Force pod recreation
kubectl rollout restart deployment/<service-name> -n mfulearnai-services
```

### Pod is CrashLoopBackOff

```bash
# Check logs
kubectl logs <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous

# Describe pod for events
kubectl describe pod <pod-name> -n <namespace>

# Common issues:
# - Missing environment variables
# - Can't connect to MongoDB/Redis
# - Missing secrets
```

### Service Can't Connect to MongoDB

```bash
# Check MongoDB is running
kubectl get pods -n mfulearnai-core -l app=mongodb

# Test DNS resolution
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- \
  nslookup mongodb.mfulearnai-core.svc.cluster.local

# Check MongoDB logs
kubectl logs statefulset/mongodb -n mfulearnai-core

# Verify secret exists
kubectl get secret mongodb-secret -n mfulearnai-core
kubectl describe secret mongodb-secret -n mfulearnai-core
```

### WebSocket Not Working

```bash
# Check chat service is running
kubectl get pods -n mfulearnai-services -l app=chat-service

# Check ingress has WebSocket annotations
kubectl describe ingress mfulearnai-ingress -n mfulearnai-gateway

# Should have:
# nginx.ingress.kubernetes.io/websocket-services: chat-service
# nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
```

### Service Returns 502 Bad Gateway

```bash
# Check service endpoints
kubectl get endpoints -n mfulearnai-services

# Check pod is ready
kubectl get pods -n mfulearnai-services

# Check service selector matches pod labels
kubectl describe service <service-name> -n mfulearnai-services
```

---

## 📊 Monitoring & Observability

### Access Grafana

```bash
# Port forward to Grafana
kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000

# Open http://localhost:3000
# Default credentials: admin / changeme123 (change in secrets)
```

### Access Prometheus

```bash
# Port forward to Prometheus
kubectl port-forward -n mfulearnai-monitoring svc/prometheus 9090:9090

# Open http://localhost:9090
```

### View Metrics

Pre-configured dashboards in Grafana:
- Kubernetes cluster overview
- Pod resource usage
- Service request rates
- MongoDB metrics
- Redis metrics

---

## 🔄 Update a Service

```bash
# Example: Update Chat Service

# 1. Make code changes locally
# 2. Commit and push to git
git add .
git commit -m "Update chat service"
git push origin kubernetes

# 3. On remote server, pull changes
cd ~/MFULearnAi
git pull origin kubernetes

# 4. Rebuild Docker image
cd k8s/services/chat-service
docker build -t mfulearnai/chat-service:latest .

# 5. Restart deployment
kubectl rollout restart deployment/chat-service -n mfulearnai-services

# 6. Watch rollout
kubectl rollout status deployment/chat-service -n mfulearnai-services
```

---

## 🗑️ Rollback

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/<service-name> -n mfulearnai-services

# Rollback to specific revision
kubectl rollout history deployment/<service-name> -n mfulearnai-services
kubectl rollout undo deployment/<service-name> --to-revision=2 -n mfulearnai-services
```

---

## 🚨 Emergency: Complete Cleanup

```bash
# WARNING: This will delete EVERYTHING!

# Delete all namespaces
kubectl delete namespace mfulearnai-core
kubectl delete namespace mfulearnai-services
kubectl delete namespace mfulearnai-gateway
kubectl delete namespace mfulearnai-monitoring

# Or use undeploy script if available
cd k8s
./undeploy.sh --all
```

---

## 📝 Post-Deployment Checklist

- [ ] All pods in Running state
- [ ] All services have endpoints
- [ ] Health checks passing
- [ ] Can access via Ingress
- [ ] SAML login working
- [ ] Chat with WebSocket working
- [ ] File upload working
- [ ] Agent execution working
- [ ] Training jobs working
- [ ] Monitoring dashboards accessible
- [ ] SSL certificates valid
- [ ] Backup strategy in place

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ All 9 microservices running (2+ pods each)
✅ Infrastructure stable (MongoDB, Redis, ChromaDB, MinIO)
✅ API Gateway routing correctly
✅ Health checks returning 200 OK
✅ Frontend accessible via https://mfulearnai.mfu.ac.th
✅ Users can login via SAML
✅ Chat conversations work
✅ File uploads succeed
✅ Background jobs processing
✅ No errors in logs
✅ Resource usage within limits

---

## 📞 Support & Documentation

- **Architecture**: See `k8s/FILE_SUMMARY.md`
- **Port Conflicts**: See `PORT_ANALYSIS.md`
- **Quick Start**: See `DEPLOY_INSTRUCTIONS.md`
- **Deployment Script**: See `k8s/deploy-all-services.sh`

---

**🚀 You're ready to deploy! Good luck!**
