# MFULearnAI Kubernetes Deployment Guide

## 📋 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Directory Structure](#directory-structure)
- [Quick Start](#quick-start)
- [Detailed Deployment Steps](#detailed-deployment-steps)
- [Service Architecture](#service-architecture)
- [Monitoring & Observability](#monitoring--observability)
- [Scaling & Performance](#scaling--performance)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

MFULearnAI uses a microservices architecture deployed on Kubernetes with the following design principles:

- **Namespace Isolation**: Services are organized into logical namespaces
- **Service Mesh Ready**: Prepared for Istio/Linkerd integration
- **Horizontal Scaling**: All services support auto-scaling with HPA
- **High Availability**: Multi-replica deployments with health checks
- **Observability**: Integrated Prometheus & Grafana monitoring

### Namespace Organization

```
mfulearnai-core        → Infrastructure (MongoDB, Redis, ChromaDB, MinIO)
mfulearnai-services    → Business logic microservices
mfulearnai-gateway     → API Gateway and Ingress
mfulearnai-monitoring  → Prometheus, Grafana, Exporters
```

## ✅ Prerequisites

### Required Tools
- `kubectl` v1.28+
- `helm` v3.12+ (optional, for cert-manager)
- Docker registry access
- Kubernetes cluster v1.28+

### Cluster Requirements
- **Minimum**: 3 nodes, 8 CPU, 32GB RAM
- **Recommended**: 5+ nodes, 16 CPU, 64GB RAM
- Storage class for PersistentVolumes
- LoadBalancer support (for Ingress)

### Required Kubernetes Features
- RBAC enabled
- Network policies support
- Metrics Server installed
- Ingress Controller (NGINX recommended)

## 📁 Directory Structure

```
k8s/
├── namespaces/
│   └── namespaces.yaml              # All namespace definitions
├── infrastructure/
│   ├── mongodb/                      # MongoDB StatefulSet
│   ├── redis/                        # Redis Deployment
│   ├── chromadb/                     # ChromaDB Deployment
│   └── minio/                        # MinIO Object Storage
├── services/
│   ├── auth-service/                 # Authentication service
│   ├── department-service/           # Department management
│   ├── chat-service/                 # Chat functionality
│   ├── agent-service/                # AI Agent orchestration
│   ├── rag-service/                  # RAG & embeddings
│   ├── training-service/             # Training jobs
│   ├── storage-service/              # File storage
│   └── bedrock-gateway/              # AWS Bedrock proxy
├── gateway/
│   ├── ingress/                      # Ingress configuration
│   └── api-gateway/                  # API Gateway service
├── monitoring/
│   ├── prometheus/                   # Metrics collection
│   ├── grafana/                      # Visualization
│   ├── mongodb-exporter.yaml         # MongoDB metrics
│   └── redis-exporter.yaml           # Redis metrics
├── secrets-template.yaml             # Secret templates (DO NOT COMMIT)
├── configmaps.yaml                   # Global configuration
└── README.md                         # This file
```

## 🚀 Quick Start

### 1. Create Namespaces
```bash
kubectl apply -f namespaces/namespaces.yaml
```

### 2. Configure Secrets
```bash
# Copy template and edit with actual values
cp secrets-template.yaml secrets.yaml
vim secrets.yaml  # Fill in actual passwords and keys

# Apply secrets
kubectl apply -f secrets.yaml

# Add to .gitignore
echo "k8s/secrets.yaml" >> .gitignore
```

### 3. Deploy Infrastructure
```bash
# MongoDB
kubectl apply -f infrastructure/mongodb/

# Redis
kubectl apply -f infrastructure/redis/

# ChromaDB
kubectl apply -f infrastructure/chromadb/

# MinIO
kubectl apply -f infrastructure/minio/

# Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n mfulearnai-core --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n mfulearnai-core --timeout=300s
kubectl wait --for=condition=ready pod -l app=chromadb -n mfulearnai-core --timeout=300s
kubectl wait --for=condition=ready pod -l app=minio -n mfulearnai-core --timeout=300s
```

### 4. Deploy Services
```bash
# Apply global config
kubectl apply -f configmaps.yaml

# Deploy microservices
kubectl apply -f services/auth-service/
kubectl apply -f services/department-service/
kubectl apply -f services/bedrock-gateway/

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=auth-service -n mfulearnai-services --timeout=300s
```

### 5. Deploy API Gateway & Ingress
```bash
kubectl apply -f gateway/api-gateway/
kubectl apply -f gateway/ingress/

# Get Ingress IP
kubectl get ingress -n mfulearnai-gateway
```

### 6. Deploy Monitoring Stack
```bash
kubectl apply -f monitoring/mongodb-exporter.yaml
kubectl apply -f monitoring/redis-exporter.yaml
kubectl apply -f monitoring/prometheus/
kubectl apply -f monitoring/grafana/

# Access Grafana
kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000
# Open http://localhost:3000 (admin / [password from secret])
```

## 📦 Detailed Deployment Steps

### Building and Pushing Docker Images

Before deploying services, build and push Docker images:

```bash
# Set your registry
export REGISTRY=your-registry.com/mfulearnai

# Auth Service
cd k8s/services/auth-service
docker build -t $REGISTRY/auth-service:latest .
docker push $REGISTRY/auth-service:latest

# Department Service
cd ../department-service
docker build -t $REGISTRY/department-service:latest .
docker push $REGISTRY/department-service:latest

# API Gateway
cd ../../gateway/api-gateway
docker build -t $REGISTRY/api-gateway:latest .
docker push $REGISTRY/api-gateway:latest
```

### Update Image References

Update deployment manifests with your registry:

```bash
# Update all deployment files
find k8s -name "deployment.yaml" -exec sed -i 's|mfulearnai/|your-registry.com/mfulearnai/|g' {} \;
```

### TLS Certificate Setup

#### Option 1: Using cert-manager (Recommended)
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@mfu.ac.th
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

#### Option 2: Manual Certificate
```bash
# Create TLS secret from existing certificates
kubectl create secret tls mfulearnai-tls \
  --cert=/path/to/cert.pem \
  --key=/path/to/key.pem \
  -n mfulearnai-gateway
```

## 🏗️ Service Architecture

### Infrastructure Layer (mfulearnai-core)

#### MongoDB
- **Type**: StatefulSet
- **Replicas**: 1 (can be scaled to ReplicaSet)
- **Storage**: 20Gi PVC
- **Port**: 27017

#### Redis
- **Type**: Deployment
- **Replicas**: 1
- **Storage**: 10Gi PVC
- **Port**: 6379

#### ChromaDB
- **Type**: Deployment
- **Replicas**: 1
- **Storage**: 50Gi PVC
- **Port**: 8000

#### MinIO
- **Type**: Deployment
- **Replicas**: 1
- **Storage**: 100Gi PVC
- **Ports**: 9000 (API), 9001 (Console)

### Service Layer (mfulearnai-services)

#### Auth Service
- **Port**: 3000
- **Replicas**: 2-10 (HPA)
- **Resources**: 256Mi-512Mi RAM, 200m-500m CPU
- **Dependencies**: MongoDB, Redis

#### Department Service
- **Port**: 3001
- **Replicas**: 2-8 (HPA)
- **Resources**: 256Mi-512Mi RAM, 200m-500m CPU
- **Dependencies**: MongoDB, Redis

### Gateway Layer (mfulearnai-gateway)

#### API Gateway
- **Port**: 8080
- **Replicas**: 3-20 (HPA)
- **Resources**: 512Mi-1Gi RAM, 500m-1000m CPU
- **Features**:
  - Request routing
  - Rate limiting
  - JWT validation
  - WebSocket support

#### Ingress
- **Controller**: NGINX
- **TLS**: Automated with cert-manager
- **Features**:
  - SSL termination
  - Path-based routing
  - CORS handling
  - Rate limiting

## 📊 Monitoring & Observability

### Prometheus

**Access**: `http://internal.mfulearnai.local/prometheus`

**Metrics Collected**:
- Kubernetes cluster metrics
- Pod CPU/Memory usage
- Service-level metrics
- Custom application metrics
- MongoDB metrics
- Redis metrics

**Retention**: 30 days

### Grafana

**Access**: `http://internal.mfulearnai.local/grafana`

**Default Dashboards**:
- Kubernetes Cluster Overview
- Pod Resource Usage
- Service Performance
- MongoDB Metrics
- Redis Metrics

**Import Additional Dashboards**:
```bash
# Kubernetes cluster monitoring
# Dashboard ID: 315
```

### Setting Up Alerts

Create AlertManager configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: mfulearnai-monitoring
data:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
    route:
      group_by: ['alertname', 'cluster']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'email'
    receivers:
    - name: 'email'
      email_configs:
      - to: 'alerts@mfu.ac.th'
        from: 'alertmanager@mfulearnai.mfu.ac.th'
        smarthost: 'smtp.mfu.ac.th:587'
```

## ⚡ Scaling & Performance

### Horizontal Pod Autoscaling

All services are configured with HPA based on CPU and memory:

```bash
# Check HPA status
kubectl get hpa -n mfulearnai-services
kubectl get hpa -n mfulearnai-gateway

# Describe HPA
kubectl describe hpa auth-service-hpa -n mfulearnai-services
```

### Manual Scaling

```bash
# Scale a deployment
kubectl scale deployment auth-service --replicas=5 -n mfulearnai-services

# Scale infrastructure
kubectl scale deployment redis --replicas=2 -n mfulearnai-core
```

### Resource Optimization

#### View Resource Usage
```bash
# Cluster-wide
kubectl top nodes
kubectl top pods --all-namespaces

# Specific namespace
kubectl top pods -n mfulearnai-services
```

#### Adjust Resource Limits
Edit deployment and update resources:
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## 🔒 Security Best Practices

### Network Policies

Create network policies to restrict pod-to-pod communication:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-netpol
  namespace: mfulearnai-services
spec:
  podSelector:
    matchLabels:
      app: auth-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: mfulearnai-gateway
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: mfulearnai-core
    ports:
    - protocol: TCP
      port: 27017  # MongoDB
    - protocol: TCP
      port: 6379   # Redis
```

### Pod Security Standards

Apply pod security standards:

```bash
# Enforce restricted policy
kubectl label namespace mfulearnai-services \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### Secret Management

**DO NOT** commit secrets to Git. Use:

1. **Sealed Secrets** (recommended)
```bash
# Install Sealed Secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Seal a secret
kubeseal --format yaml < secrets.yaml > sealed-secrets.yaml
kubectl apply -f sealed-secrets.yaml
```

2. **External Secrets Operator**
3. **HashiCorp Vault**

### RBAC

Create service accounts with minimal permissions:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: auth-service-sa
  namespace: mfulearnai-services
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: auth-service-role
  namespace: mfulearnai-services
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
```

## 🔧 Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n mfulearnai-services

# View pod details
kubectl describe pod <pod-name> -n mfulearnai-services

# Check logs
kubectl logs <pod-name> -n mfulearnai-services

# Check events
kubectl get events -n mfulearnai-services --sort-by='.lastTimestamp'
```

#### Service Connection Issues

```bash
# Test service connectivity
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash

# Inside the debug pod:
nslookup mongodb.mfulearnai-core.svc.cluster.local
curl http://auth-service.mfulearnai-services.svc.cluster.local:3000/health
```

#### Database Connection Issues

```bash
# Connect to MongoDB pod
kubectl exec -it mongodb-0 -n mfulearnai-core -- mongosh

# Connect to Redis
kubectl exec -it $(kubectl get pod -l app=redis -n mfulearnai-core -o jsonpath='{.items[0].metadata.name}') -n mfulearnai-core -- redis-cli
```

#### Storage Issues

```bash
# Check PVCs
kubectl get pvc -n mfulearnai-core

# Check PV
kubectl get pv

# Describe PVC
kubectl describe pvc mongodb-data-mongodb-0 -n mfulearnai-core
```

### Health Checks

```bash
# Check all pods health
kubectl get pods --all-namespaces | grep -v Running

# Check service endpoints
kubectl get endpoints -n mfulearnai-services

# Test readiness probes
kubectl get pods -n mfulearnai-services -o json | jq '.items[] | {name: .metadata.name, ready: .status.conditions[] | select(.type=="Ready")}'
```

### Performance Issues

```bash
# Check resource utilization
kubectl top nodes
kubectl top pods -n mfulearnai-services --sort-by=cpu
kubectl top pods -n mfulearnai-services --sort-by=memory

# Check HPA metrics
kubectl get hpa -n mfulearnai-services -w
```

### Logs Aggregation

```bash
# View logs from all replicas
kubectl logs -l app=auth-service -n mfulearnai-services --tail=100 -f

# Export logs
kubectl logs deployment/auth-service -n mfulearnai-services > auth-service.log
```

## 🔄 Deployment Updates

### Rolling Updates

```bash
# Update image
kubectl set image deployment/auth-service auth-service=your-registry/auth-service:v2.0 -n mfulearnai-services

# Watch rollout
kubectl rollout status deployment/auth-service -n mfulearnai-services

# Rollback if needed
kubectl rollout undo deployment/auth-service -n mfulearnai-services
```

### Canary Deployments

Create a canary deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service-canary
  namespace: mfulearnai-services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: auth-service
      version: canary
  template:
    metadata:
      labels:
        app: auth-service
        version: canary
    spec:
      # ... same as original but with new image
```

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Prometheus Operator](https://prometheus-operator.dev/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

## 🤝 Contributing

For internal MFU IT team:
1. Test changes in staging environment first
2. Document all configuration changes
3. Update this README with new procedures
4. Review security implications

## 📞 Support

- Internal Wiki: `https://wiki.mfu.ac.th/mfulearnai`
- Slack Channel: `#mfulearnai-ops`
- Email: `mfulearnai-support@mfu.ac.th`
