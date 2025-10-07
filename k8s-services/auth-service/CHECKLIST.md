# Auth Service Deployment Checklist

## ✅ Pre-Deployment Checklist

### Local Machine
- [ ] Code is committed to Git
- [ ] All files are present in `k8s-services/auth-service/`
- [ ] `.env` file has production values
- [ ] `k8s/secret.yaml` has production secrets
- [ ] Code pushed to branch `bedrock`

### Production Server Prerequisites
- [ ] K8s cluster is running
- [ ] `kubectl` is configured and working
- [ ] MongoDB is deployed and accessible at `mongodb:27017`
- [ ] Namespace `mfulearnai` exists (will be created if not)
- [ ] Docker is installed and running

## 📦 Deployment Steps

### 1. SSH to Server
```bash
ssh mfulearnai@10.1.44.204
```
- [ ] Successfully connected to server

### 2. Pull Latest Code
```bash
cd /path/to/MFULearnAi
git pull origin bedrock
```
- [ ] Latest code pulled successfully
- [ ] No merge conflicts

### 3. Navigate to Service Directory
```bash
cd k8s-services/auth-service
ls -la
```
- [ ] All files present (src/, k8s/, Dockerfile, etc.)
- [ ] `.env` file exists with production values
- [ ] `k8s/secret.yaml` exists with real secrets

### 4. Build Docker Image
```bash
docker build -t mfulearnai/auth-service:latest .
```
- [ ] Build completed without errors
- [ ] Image created successfully

### 5. Deploy to Kubernetes
```bash
chmod +x deploy.sh
./deploy.sh
```
- [ ] Namespace created
- [ ] ConfigMap applied
- [ ] Secret applied
- [ ] Deployment created
- [ ] Service created
- [ ] HPA created
- [ ] Rollout completed successfully

## 🔍 Verification Steps

### 1. Check Pods
```bash
kubectl get pods -n mfulearnai -l app=auth-service
```
Expected: 2/2 pods in `Running` state
- [ ] At least 2 pods running
- [ ] All pods in `Running` state
- [ ] No crash loops or errors

### 2. Check Service
```bash
kubectl get svc -n mfulearnai auth-service
```
Expected: ClusterIP service on port 3001
- [ ] Service created
- [ ] ClusterIP assigned
- [ ] Port 3001 exposed

### 3. Check HPA
```bash
kubectl get hpa -n mfulearnai auth-service-hpa
```
Expected: Min 2, Max 10 replicas
- [ ] HPA created
- [ ] Metrics available
- [ ] Current replicas: 2

### 4. View Logs
```bash
kubectl logs -n mfulearnai -l app=auth-service --tail=50
```
Expected: No error messages, "Server running on port 3001"
- [ ] No error messages in logs
- [ ] MongoDB connected message
- [ ] Server started successfully

### 5. Test Health Endpoint
```bash
kubectl port-forward -n mfulearnai svc/auth-service 3001:3001
# In another terminal:
curl http://localhost:3001/health
```
Expected: `{"status":"healthy","service":"auth-service","timestamp":"..."}`
- [ ] Port forward successful
- [ ] Health endpoint returns 200 OK
- [ ] Response JSON is valid

### 6. Test Service Info
```bash
curl http://localhost:3001/
```
Expected: Service info with endpoints list
- [ ] Returns service information
- [ ] Lists all auth endpoints

## 🧪 Functional Testing

### 1. Test SAML Metadata
```bash
curl http://localhost:3001/api/auth/metadata
```
- [ ] Returns XML metadata
- [ ] No errors in response

### 2. Test Admin Login (if admin user exists)
```bash
curl -X POST http://localhost:3001/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```
- [ ] Returns JWT token
- [ ] Token is valid JWT format

### 3. Test JWT Validation
```bash
# Use token from admin login
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```
- [ ] Returns user information
- [ ] No authentication errors

### 4. Test SAML Login Flow (Browser)
Navigate to: `https://mfulearnai.mfu.ac.th/api/auth/login/saml`
- [ ] Redirects to SAML IDP
- [ ] Can complete authentication
- [ ] Redirects back with token
- [ ] Token is valid

## 🔧 Troubleshooting Checklist

### If Pods Not Starting
- [ ] Check pod description: `kubectl describe pod <pod-name> -n mfulearnai`
- [ ] Check events: `kubectl get events -n mfulearnai --sort-by='.lastTimestamp'`
- [ ] Check image pull: Image exists in `docker images`
- [ ] Check secrets: `kubectl get secret auth-service-secrets -n mfulearnai`

### If Health Check Failing
- [ ] Check logs for errors
- [ ] Verify port 3001 is listening
- [ ] Check MongoDB connection
- [ ] Verify environment variables loaded

### If MongoDB Connection Failing
- [ ] Check MongoDB service: `kubectl get svc -n mfulearnai mongodb`
- [ ] Check MongoDB pods: `kubectl get pods -n mfulearnai -l app=mongodb`
- [ ] Test connection from pod: `kubectl exec -it <pod> -n mfulearnai -- nc -zv mongodb 27017`
- [ ] Verify MongoDB URI in secret

### If SAML Authentication Failing
- [ ] Check SAML certificate is correct
- [ ] Verify IDP URLs are accessible
- [ ] Check logs for SAML errors
- [ ] Test metadata endpoint

## 📊 Monitoring Checklist

### Daily Monitoring
- [ ] Check pod health: All pods running
- [ ] Check logs: No error patterns
- [ ] Check HPA: Scaling working properly
- [ ] Check resource usage: Within limits

### Weekly Monitoring
- [ ] Review authentication logs
- [ ] Check token generation rate
- [ ] Review failed login attempts
- [ ] Update secrets if needed

## ✅ Post-Deployment Checklist

### Immediate (Day 1)
- [ ] All verification tests passed
- [ ] Functional tests passed
- [ ] No errors in logs for 1 hour
- [ ] SAML login works end-to-end
- [ ] Admin login works
- [ ] Token validation works

### Short-term (Week 1)
- [ ] Service stable for 1 week
- [ ] No memory leaks detected
- [ ] Auto-scaling working properly
- [ ] No authentication failures
- [ ] Performance meets expectations

### Long-term
- [ ] Document any issues encountered
- [ ] Update configuration if needed
- [ ] Plan for next service deployment
- [ ] Consider setting up monitoring alerts

## 🚀 Next Steps After Successful Deployment

1. **Update API Gateway/Ingress**
   - [ ] Route `/api/auth/*` to auth-service
   - [ ] Test routing works correctly

2. **Migrate Traffic Gradually**
   - [ ] Route 10% traffic to auth-service
   - [ ] Monitor for errors
   - [ ] Gradually increase to 100%

3. **Deploy Next Service**
   - [ ] Plan Department Service deployment
   - [ ] Or choose another service to deploy next

4. **Decommission Old Auth Code**
   - [ ] Once fully migrated and stable
   - [ ] Keep as backup for rollback

## 📝 Sign-off

- Deployed by: _______________
- Date: _______________
- All checks passed: [ ] Yes [ ] No
- Issues encountered: _______________
- Notes: _______________
