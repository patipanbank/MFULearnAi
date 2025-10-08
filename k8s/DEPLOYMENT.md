# MFULearnAI Production Deployment Checklist

## 📋 Pre-Deployment Checklist

### Infrastructure Preparation
- [ ] Kubernetes cluster provisioned (v1.28+)
- [ ] kubectl configured and authenticated
- [ ] Storage class configured for PersistentVolumes
- [ ] LoadBalancer/Ingress controller installed (NGINX recommended)
- [ ] Metrics Server installed
- [ ] DNS configured for domain: `mfulearnai.mfu.ac.th`
- [ ] SSL/TLS certificates obtained
- [ ] Docker registry access configured

### Security Configuration
- [ ] All secrets generated with strong passwords (min 32 chars)
- [ ] JWT secrets generated (use `openssl rand -base64 32`)
- [ ] Session secrets generated
- [ ] MongoDB root password set
- [ ] MinIO credentials set
- [ ] Grafana admin password set
- [ ] AWS credentials configured (if using Bedrock)
- [ ] SAML certificates configured (if using SAML auth)

### Container Images
- [ ] All Docker images built
- [ ] Images pushed to registry
- [ ] Image tags updated in manifests
- [ ] Images scanned for vulnerabilities

## 🚀 Step-by-Step Deployment

### Phase 1: Create Namespaces (5 min)

```bash
# Create all namespaces
kubectl apply -f namespaces/namespaces.yaml

# Verify
kubectl get namespaces | grep mfulearnai
```

**Expected Output**:
```
mfulearnai-core        Active   30s
mfulearnai-services    Active   30s
mfulearnai-gateway     Active   30s
mfulearnai-monitoring  Active   30s
```

### Phase 2: Configure Secrets (10 min)

```bash
# Generate strong passwords
export MONGODB_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
export SESSION_SECRET=$(openssl rand -base64 32)
export MINIO_PASSWORD=$(openssl rand -base64 32)
export GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Create secrets.yaml from template
cp secrets-template.yaml secrets.yaml

# Update secrets.yaml with generated passwords
# Use your preferred editor (vim, nano, code)
vim secrets.yaml

# Apply secrets
kubectl apply -f secrets.yaml

# Verify secrets created
kubectl get secrets -n mfulearnai-core
kubectl get secrets -n mfulearnai-services
kubectl get secrets -n mfulearnai-gateway
kubectl get secrets -n mfulearnai-monitoring

# IMPORTANT: Save passwords to secure location
echo "MONGODB_PASSWORD=$MONGODB_PASSWORD" > .env.prod.backup
echo "JWT_SECRET=$JWT_SECRET" >> .env.prod.backup
echo "SESSION_SECRET=$SESSION_SECRET" >> .env.prod.backup
echo "MINIO_PASSWORD=$MINIO_PASSWORD" >> .env.prod.backup
echo "GRAFANA_PASSWORD=$GRAFANA_PASSWORD" >> .env.prod.backup

# Store .env.prod.backup in secure vault (1Password, Vault, etc.)
```

### Phase 3: Deploy Infrastructure (20 min)

#### 3.1 MongoDB
```bash
kubectl apply -f infrastructure/mongodb/

# Wait for StatefulSet to be ready
kubectl rollout status statefulset/mongodb -n mfulearnai-core --timeout=5m

# Verify MongoDB is running
kubectl get pods -n mfulearnai-core -l app=mongodb
kubectl logs -n mfulearnai-core mongodb-0 --tail=20

# Test MongoDB connection
kubectl exec -it mongodb-0 -n mfulearnai-core -- mongosh -u root -p "$MONGODB_PASSWORD"
# In MongoDB shell: db.adminCommand('ping')
# Should return: { ok: 1 }
```

#### 3.2 Redis
```bash
kubectl apply -f infrastructure/redis/

# Wait for deployment
kubectl rollout status deployment/redis -n mfulearnai-core --timeout=5m

# Verify Redis
kubectl exec -it $(kubectl get pod -l app=redis -n mfulearnai-core -o jsonpath='{.items[0].metadata.name}') -n mfulearnai-core -- redis-cli ping
# Should return: PONG
```

#### 3.3 ChromaDB
```bash
kubectl apply -f infrastructure/chromadb/

# Wait for deployment
kubectl rollout status deployment/chromadb -n mfulearnai-core --timeout=5m

# Test ChromaDB
kubectl port-forward -n mfulearnai-core svc/chromadb 8000:8000 &
curl http://localhost:8000/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}
pkill -f "port-forward.*chromadb"
```

#### 3.4 MinIO
```bash
kubectl apply -f infrastructure/minio/

# Wait for deployment
kubectl rollout status deployment/minio -n mfulearnai-core --timeout=5m

# Access MinIO Console (optional)
kubectl port-forward -n mfulearnai-core svc/minio 9001:9001
# Open http://localhost:9001
# Login: minioadmin / [your-minio-password]
```

**Infrastructure Health Check**:
```bash
kubectl get pods -n mfulearnai-core
# All pods should be Running and Ready
```

### Phase 4: Deploy Configuration (5 min)

```bash
# Apply global configuration
kubectl apply -f configmaps.yaml

# Verify ConfigMaps
kubectl get configmaps -n mfulearnai-services
kubectl get configmaps -n mfulearnai-gateway
```

### Phase 5: Deploy Microservices (30 min)

#### 5.1 Auth Service
```bash
kubectl apply -f services/auth-service/

# Watch rollout
kubectl rollout status deployment/auth-service -n mfulearnai-services --timeout=5m

# Check logs
kubectl logs -f deployment/auth-service -n mfulearnai-services

# Test health endpoint
kubectl port-forward -n mfulearnai-services svc/auth-service 3000:3000 &
curl http://localhost:3000/health
pkill -f "port-forward.*auth-service"
```

#### 5.2 Department Service
```bash
kubectl apply -f services/department-service/

# Watch rollout
kubectl rollout status deployment/department-service -n mfulearnai-services --timeout=5m

# Verify
kubectl get pods -n mfulearnai-services -l app=department-service
```

#### 5.3 Bedrock Gateway (if using AWS Bedrock)
```bash
# Ensure AWS credentials are set in secrets
kubectl apply -f services/bedrock-gateway/

# Watch rollout
kubectl rollout status deployment/bedrock-gateway -n mfulearnai-services --timeout=5m
```

**Services Health Check**:
```bash
kubectl get pods -n mfulearnai-services
kubectl get svc -n mfulearnai-services
```

### Phase 6: Deploy API Gateway (15 min)

```bash
# Deploy API Gateway
kubectl apply -f gateway/api-gateway/

# Watch rollout
kubectl rollout status deployment/api-gateway -n mfulearnai-gateway --timeout=5m

# Verify
kubectl get pods -n mfulearnai-gateway -l app=api-gateway
kubectl logs -f deployment/api-gateway -n mfulearnai-gateway
```

### Phase 7: Configure Ingress (10 min)

#### 7.1 Setup TLS Certificate

**Option A: Using cert-manager (Recommended)**
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=5m

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: mfulearnai@mfu.ac.th
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

**Option B: Manual Certificate**
```bash
# If you have existing certificates
kubectl create secret tls mfulearnai-tls \
  --cert=/path/to/mfulearnai.mfu.ac.th.crt \
  --key=/path/to/mfulearnai.mfu.ac.th.key \
  -n mfulearnai-gateway
```

#### 7.2 Deploy Ingress
```bash
# Update Ingress with your domain
vim gateway/ingress/ingress.yaml
# Update: mfulearnai.mfu.ac.th with your actual domain

# Apply Ingress
kubectl apply -f gateway/ingress/

# Get Ingress details
kubectl get ingress -n mfulearnai-gateway
kubectl describe ingress mfulearnai-ingress -n mfulearnai-gateway

# Get LoadBalancer IP
INGRESS_IP=$(kubectl get ingress mfulearnai-ingress -n mfulearnai-gateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Configure DNS: mfulearnai.mfu.ac.th -> $INGRESS_IP"
```

### Phase 8: Deploy Monitoring (15 min)

#### 8.1 MongoDB & Redis Exporters
```bash
kubectl apply -f monitoring/mongodb-exporter.yaml
kubectl apply -f monitoring/redis-exporter.yaml

# Verify exporters
kubectl get pods -n mfulearnai-core | grep exporter
```

#### 8.2 Prometheus
```bash
kubectl apply -f monitoring/prometheus/

# Wait for Prometheus
kubectl rollout status deployment/prometheus -n mfulearnai-monitoring --timeout=5m

# Access Prometheus (for verification)
kubectl port-forward -n mfulearnai-monitoring svc/prometheus 9090:9090
# Open http://localhost:9090
# Check targets: http://localhost:9090/targets
```

#### 8.3 Grafana
```bash
kubectl apply -f monitoring/grafana/

# Wait for Grafana
kubectl rollout status deployment/grafana -n mfulearnai-monitoring --timeout=5m

# Access Grafana
kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000
# Open http://localhost:3000
# Login: admin / [your-grafana-password]
```

### Phase 9: Post-Deployment Verification (10 min)

```bash
# Check all pods
kubectl get pods --all-namespaces | grep mfulearnai

# Check all services
kubectl get svc --all-namespaces | grep mfulearnai

# Check all ingresses
kubectl get ingress --all-namespaces

# Check HPA status
kubectl get hpa -n mfulearnai-services
kubectl get hpa -n mfulearnai-gateway

# Check PVC status
kubectl get pvc -n mfulearnai-core
kubectl get pvc -n mfulearnai-monitoring
```

### Phase 10: Functional Testing (30 min)

```bash
# Test external access
curl -k https://mfulearnai.mfu.ac.th/api/health

# Test authentication endpoint
curl -k -X POST https://mfulearnai.mfu.ac.th/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test WebSocket
wscat -c wss://mfulearnai.mfu.ac.th/ws

# Load testing (optional)
ab -n 1000 -c 10 https://mfulearnai.mfu.ac.th/api/health
```

## 📊 Monitoring Setup

### Access Monitoring Dashboards

```bash
# Prometheus
kubectl port-forward -n mfulearnai-monitoring svc/prometheus 9090:9090

# Grafana
kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000
```

### Import Grafana Dashboards

1. Login to Grafana (http://localhost:3000)
2. Go to Dashboards → Import
3. Import these dashboard IDs:
   - **315**: Kubernetes cluster monitoring
   - **6417**: Kubernetes cluster monitoring (Prometheus)
   - **763**: Redis Dashboard for Prometheus Redis Exporter
   - **2583**: MongoDB Exporter Dashboard

## 🔧 Post-Deployment Tasks

### Setup Automated Backups

```bash
# MongoDB backup CronJob
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: mfulearnai-core
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mongo:7.0
            command:
            - /bin/sh
            - -c
            - |
              mongodump --uri="$MONGODB_URI" --archive=/backup/backup-\$(date +%Y%m%d-%H%M%S).archive --gzip
              # Upload to S3 or other storage
            env:
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: mongodb-secret
                  key: mongodb-uri
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
EOF
```

### Setup Alerting

```bash
# Create AlertManager rules
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-rules
  namespace: mfulearnai-monitoring
data:
  alerts.yml: |
    groups:
    - name: mfulearnai
      interval: 30s
      rules:
      - alert: PodDown
        expr: up{job=~".*-service"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod {{ \$labels.job }} is down"
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{namespace="mfulearnai-services"} > 1e9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ \$labels.pod }}"
EOF
```

### Configure Log Aggregation (Optional)

For production, consider deploying EFK/ELK stack:
- Elasticsearch for log storage
- Fluentd/Filebeat for log collection
- Kibana for log visualization

## 🔒 Security Hardening

### Enable Pod Security Policies

```bash
# Enforce restricted security for services
kubectl label namespace mfulearnai-services \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### Network Policies

```bash
# Apply network policies to restrict traffic
kubectl apply -f network-policies/
```

### Enable Audit Logging

Configure Kubernetes audit logging at cluster level to track all API calls.

## 📝 Documentation

After deployment, update the following:
- [ ] Internal wiki with access credentials
- [ ] Runbook with common operations
- [ ] Incident response procedures
- [ ] Backup and restore procedures
- [ ] Scaling procedures

## 🚨 Rollback Procedure

If deployment fails or issues occur:

```bash
# Rollback a specific deployment
kubectl rollout undo deployment/auth-service -n mfulearnai-services

# Rollback to specific revision
kubectl rollout undo deployment/auth-service --to-revision=2 -n mfulearnai-services

# Delete all resources and start over
kubectl delete -f infrastructure/
kubectl delete -f services/
kubectl delete -f gateway/
kubectl delete -f monitoring/
kubectl delete -f namespaces/
```

## ✅ Success Criteria

Deployment is successful when:
- [ ] All pods in Running state
- [ ] All services accessible via Ingress
- [ ] Authentication working
- [ ] Database connections working
- [ ] Monitoring dashboards showing data
- [ ] Health checks passing
- [ ] TLS certificates valid
- [ ] HPA configured and working
- [ ] No critical errors in logs
- [ ] Load testing passed

## 📞 Support

If you encounter issues:
1. Check logs: `kubectl logs -f <pod-name> -n <namespace>`
2. Check events: `kubectl get events -n <namespace> --sort-by='.lastTimestamp'`
3. Consult README.md troubleshooting section
4. Contact: mfulearnai-support@mfu.ac.th
