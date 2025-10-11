# Host NGINX Configuration

This directory contains NGINX configuration for the host server to proxy requests to Kubernetes Ingress.

## Problem

The host server has NGINX running that was configured to proxy to Docker Compose (`localhost:3000`). This causes all requests to bypass Kubernetes entirely.

## Solution

Update the host NGINX to proxy to Kubernetes Ingress NodePort (`localhost:31530`) instead.

## Files

- `mfulearnai.mfu.ac.th.conf` - Updated NGINX configuration
- `update-host-nginx.sh` - Script to deploy the configuration

## Deployment Steps

### On Local Machine

```bash
# Commit and push changes
git add deployment/nginx/
git commit -m "feat: Add host NGINX config for Kubernetes proxy"
git push
```

### On Server

```bash
# Pull latest changes
cd MFULearnAi
git pull

# Run update script (requires sudo)
bash deployment/nginx/update-host-nginx.sh
```

## What Changed

**Before:**
```nginx
location / {
    proxy_pass http://localhost:3000;  # Docker Compose backend
}
```

**After:**
```nginx
location / {
    proxy_pass http://localhost:31530;  # Kubernetes Ingress NodePort
}
```

## Request Flow After Update

```
Browser (https://mfulearnai.mfu.ac.th/api/auth/login/saml)
  ↓
Host NGINX (port 443)
  ↓
Kubernetes Ingress NodePort (31530)
  ↓
Kubernetes Ingress Controller
  ↓
Auth Service (port 5001)
  ↓
SAML Authentication
```

## Verification

After updating, test the auth endpoint:

```bash
curl -k -I https://mfulearnai.mfu.ac.th/api/auth/login/saml
```

You should receive a redirect (302) to the SAML IdP, not HTML from the frontend.

Check auth-service logs to confirm requests are reaching it:

```bash
kubectl logs -f -n mfulearnai -l app=auth-service
```

## Rollback

If something goes wrong, restore the backup:

```bash
sudo cp /etc/nginx/sites-available/mfulearnai.mfu.ac.th.backup.* /etc/nginx/sites-available/mfulearnai.mfu.ac.th
sudo nginx -s reload
```

## Alternative: Use Docker Compose Only

If you prefer not to use Kubernetes, you can:

1. Stop host NGINX: `sudo systemctl stop nginx`
2. Update docker-compose.yml to expose port 443
3. Use Docker Compose: `docker-compose up -d`

This bypasses Kubernetes entirely and uses the monolithic backend instead.
