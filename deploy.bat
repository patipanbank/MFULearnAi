@echo off
REM ========================================
REM LangGraph Agent Deployment Script
REM ========================================

SET SERVER=mfulearnai@10.1.44.204

echo ========================================
echo 🚀 LangGraph Agent Deployment
echo ========================================
echo.

echo Step 1/5: Pulling latest code...
ssh %SERVER% "cd MFULearnAi && git fetch origin kubernetes && git reset --hard origin/kubernetes"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to pull code
    pause
    exit /b 1
)
echo ✅ Code updated
echo.

echo Step 2/5: Installing dependencies...
ssh %SERVER% "cd MFULearnAi/k8s/services/agent-service && npm install --production"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

echo Step 3/5: Building TypeScript...
ssh %SERVER% "cd MFULearnAi/k8s/services/agent-service && npm run build"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✅ Build completed
echo.

echo Step 4/5: Restarting agent-service...
ssh %SERVER% "cd MFULearnAi && docker-compose stop agent-service && docker-compose rm -f agent-service && docker-compose up -d agent-service"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to restart service
    pause
    exit /b 1
)
echo ✅ Service restarted
echo.

echo Step 5/5: Verifying deployment...
echo ⏳ Waiting for service to start...
timeout /t 15 /nobreak >nul
echo.

ssh %SERVER% "docker ps | grep agent-service"
if %ERRORLEVEL% EQ 0 (
    echo ✅ Service is running!
) else (
    echo ⚠️  Service may not be running properly
)
echo.

echo 📋 Recent logs:
ssh %SERVER% "docker logs agent-service --tail 20"
echo.

echo ========================================
echo 🎉 Deployment Complete!
echo ========================================
echo.
echo To view live logs:
echo   ssh %SERVER% "docker logs -f agent-service"
echo.
pause
