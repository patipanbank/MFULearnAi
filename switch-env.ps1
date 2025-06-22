param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment
)

$ErrorActionPreference = 'Stop'

Write-Host "Switching to $Environment environment..."

# Stop containers
docker-compose down

# Copy appropriate nginx config
if ($Environment -eq 'dev') {
    Copy-Item -Path "./nginx/nginx.dev.conf.template" -Destination "./nginx/nginx.conf.template" -Force
    Write-Host "Switched to development nginx configuration"
} else {
    Copy-Item -Path "./nginx/nginx.prod.conf.template" -Destination "./nginx/nginx.conf.template" -Force
    Write-Host "Switched to production nginx configuration"
}

# Rebuild and start containers
docker-compose build nginx
docker-compose up -d

Write-Host "Environment switched successfully to $Environment"
Write-Host "Containers are starting up..."

# Show container status
docker-compose ps 