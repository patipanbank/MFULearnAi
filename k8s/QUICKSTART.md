# MFULearnAI Kubernetes Quick Start

## 🚀 5-Minute Quick Deploy

### Prerequisites
```bash
# Check if kubectl is installed and connected
kubectl cluster-info

# Verify you're in the right cluster
kubectl config current-context
```

### Deploy Everything
```bash
cd k8s

# 1. Create secrets from template
cp secrets-template.yaml secrets.yaml
# Edit secrets.yaml with real passwords
vim secrets.yaml

# 2. Deploy using the script
./deploy.sh --all

# 3. Check status
kubectl get pods --all-namespaces | grep mfulearnai
```

That's it! Your services should be running.

---

## 📊 Common Commands

### View All Resources
```bash
# All pods
kubectl get pods -A | grep mfulearnai

# All services
kubectl get svc -A | grep mfulearnai

# Ingress
kubectl get ingress -n mfulearnai-gateway
```

### Check Service Health
```bash
# Auth service
kubectl logs -f deployment/auth-service -n mfulearnai-services

# Department service
kubectl logs -f deployment/department-service -n mfulearnai-services

# API Gateway
kubectl logs -f deployment/api-gateway -n mfulearnai-gateway
```

### Access Services Locally
```bash
# Grafana
kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000
# Open http://localhost:3000

# Prometheus
kubectl port-forward -n mfulearnai-monitoring svc/prometheus 9090:9090
# Open http://localhost:9090

# MongoDB (using mongosh)
kubectl exec -it mongodb-0 -n mfulearnai-core -- mongosh

# Redis
kubectl exec -it $(kubectl get pod -l app=redis -n mfulearnai-core -o jsonpath='{.items[0].metadata.name}') -n mfulearnai-core -- redis-cli
```

### Scale Services
```bash
# Scale auth service
kubectl scale deployment auth-service --replicas=5 -n mfulearnai-services

# Scale API gateway
kubectl scale deployment api-gateway --replicas=10 -n mfulearnai-gateway
```

### Update Service
```bash
# Update image
kubectl set image deployment/auth-service auth-service=registry.com/auth-service:v2.0 -n mfulearnai-services

# Watch rollout
kubectl rollout status deployment/auth-service -n mfulearnai-services

# Rollback if needed
kubectl rollout undo deployment/auth-service -n mfulearnai-services
```

### Debug Pod Issues
```bash
# Describe pod
kubectl describe pod <pod-name> -n <namespace>

# View events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Execute commands in pod
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh

# Debug with netshoot
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash
```

### View Logs
```bash
# Recent logs
kubectl logs <pod-name> -n <namespace> --tail=100

# Follow logs
kubectl logs -f <pod-name> -n <namespace>

# Logs from all replicas
kubectl logs -l app=auth-service -n mfulearnai-services --tail=50

# Previous container logs (if crashed)
kubectl logs <pod-name> -n <namespace> --previous
```

### Resource Usage
```bash
# Node usage
kubectl top nodes

# Pod usage
kubectl top pods -n mfulearnai-services

# Sorted by CPU
kubectl top pods -n mfulearnai-services --sort-by=cpu

# Sorted by memory
kubectl top pods -n mfulearnai-services --sort-by=memory
```

---

## 🔧 Quick Fixes

### Pods Not Starting
```bash
# 1. Check pod status
kubectl get pods -n <namespace>

# 2. Describe pod for errors
kubectl describe pod <pod-name> -n <namespace>

# 3. Check events
kubectl get events -n <namespace> | tail -20

# 4. Common issues:
# - ImagePullBackOff: Check image name and registry access
# - CrashLoopBackOff: Check logs for application errors
# - Pending: Check resource availability and PVC binding
```

### Service Not Accessible
```bash
# 1. Check service endpoints
kubectl get endpoints <service-name> -n <namespace>

# 2. Test from inside cluster
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash
# Inside: curl http://<service-name>.<namespace>.svc.cluster.local:<port>

# 3. Check service selector matches pod labels
kubectl get svc <service-name> -n <namespace> -o yaml | grep selector
kubectl get pods -n <namespace> --show-labels
```

### Database Connection Issues
```bash
# Check MongoDB
kubectl exec -it mongodb-0 -n mfulearnai-core -- mongosh -u root -p <password>

# Check Redis
kubectl exec -it $(kubectl get pod -l app=redis -n mfulearnai-core -o jsonpath='{.items[0].metadata.name}') -n mfulearnai-core -- redis-cli ping

# Check secret values
kubectl get secret mongodb-secret -n mfulearnai-core -o jsonpath='{.data.mongodb-uri}' | base64 -d
```

### High Resource Usage
```bash
# Check which pods are using most resources
kubectl top pods -A --sort-by=memory | head -20

# Check HPA status
kubectl get hpa -A

# Manually scale down if needed
kubectl scale deployment <name> --replicas=1 -n <namespace>
```

---

## 🗑️ Clean Up

### Remove Everything
```bash
# Use undeploy script
./undeploy.sh --all

# Or manually
kubectl delete namespace mfulearnai-core
kubectl delete namespace mfulearnai-services
kubectl delete namespace mfulearnai-gateway
kubectl delete namespace mfulearnai-monitoring
```

### Remove Specific Components
```bash
# Remove monitoring only
./undeploy.sh --monitoring

# Remove services only
./undeploy.sh --services

# Remove infrastructure (WARNING: deletes data!)
./undeploy.sh --infra
```

---

## 📱 Mobile-Friendly Commands

### One-Line Status Check
```bash
kubectl get pods -A | grep mfulearnai | grep -v Running
```

### Quick Health Check
```bash
kubectl get pods -n mfulearnai-services && kubectl get pods -n mfulearnai-core && kubectl get pods -n mfulearnai-gateway
```

### Restart All Services
```bash
kubectl rollout restart deployment -n mfulearnai-services
```

---

## 🆘 Emergency Procedures

### Complete System Restart
```bash
# 1. Scale down all services
kubectl scale deployment --all --replicas=0 -n mfulearnai-services
kubectl scale deployment --all --replicas=0 -n mfulearnai-gateway

# 2. Restart infrastructure
kubectl rollout restart statefulset mongodb -n mfulearnai-core
kubectl rollout restart deployment redis -n mfulearnai-core
kubectl rollout restart deployment chromadb -n mfulearnai-core

# 3. Wait for infrastructure
sleep 30

# 4. Scale up services
kubectl scale deployment --all --replicas=2 -n mfulearnai-services
kubectl scale deployment --all --replicas=3 -n mfulearnai-gateway
```

### Recover from Failed Deployment
```bash
# Rollback all deployments
kubectl rollout undo deployment/auth-service -n mfulearnai-services
kubectl rollout undo deployment/department-service -n mfulearnai-services
kubectl rollout undo deployment/api-gateway -n mfulearnai-gateway
```

### Emergency Database Backup
```bash
# MongoDB
kubectl exec mongodb-0 -n mfulearnai-core -- mongodump --archive=/tmp/backup.archive --gzip
kubectl cp mfulearnai-core/mongodb-0:/tmp/backup.archive ./mongodb-backup-$(date +%Y%m%d).archive

# Redis (save snapshot)
kubectl exec -it $(kubectl get pod -l app=redis -n mfulearnai-core -o jsonpath='{.items[0].metadata.name}') -n mfulearnai-core -- redis-cli save
```

---

## 📚 Next Steps

- [Full Documentation](README.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Architecture Overview](ARCHITECTURE.md)

## 🤝 Support

- Email: mfulearnai-support@mfu.ac.th
- Slack: #mfulearnai-ops
- Wiki: https://wiki.mfu.ac.th/mfulearnai
