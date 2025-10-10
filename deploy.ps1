# PowerShell Deployment Script for LangGraph Agent
# Run this script on Windows to deploy to remote server

$ErrorActionPreference = "Continue"
$server = "mfulearnai@10.1.44.204"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 LangGraph Agent Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull code
Write-Host "Step 1/5: Pulling latest code..." -ForegroundColor Blue
$pullCmd = "cd MFULearnAi && git fetch origin kubernetes && git reset --hard origin/kubernetes"
ssh $server $pullCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Code updated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to pull code" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Install dependencies
Write-Host "Step 2/5: Installing dependencies..." -ForegroundColor Blue
$installCmd = "cd MFULearnAi/k8s/services/agent-service && npm install --production"
ssh $server $installCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Build
Write-Host "Step 3/5: Building TypeScript..." -ForegroundColor Blue
$buildCmd = "cd MFULearnAi/k8s/services/agent-service && npm run build"
ssh $server $buildCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Restart service
Write-Host "Step 4/5: Restarting agent-service..." -ForegroundColor Blue
$restartCmd = "cd MFULearnAi && docker-compose stop agent-service && docker-compose rm -f agent-service && docker-compose up -d agent-service"
ssh $server $restartCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Service restarted" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to restart service" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Wait and verify
Write-Host "Step 5/5: Verifying deployment..." -ForegroundColor Blue
Write-Host "⏳ Waiting for service to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

$statusCmd = "docker ps | grep agent-service"
ssh $server $statusCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Service is running!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Service may not be running properly" -ForegroundColor Yellow
}
Write-Host ""

# Check logs
Write-Host "📋 Recent logs:" -ForegroundColor Yellow
$logsCmd = "docker logs agent-service --tail 20"
ssh $server $logsCmd
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view live logs, run:" -ForegroundColor Yellow
Write-Host "  ssh $server docker logs -f agent-service" -ForegroundColor White
Write-Host ""
