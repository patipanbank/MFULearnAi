# MFU Learn AI - Production Ready

AI-powered learning platform for Mae Fah Luang University

## Version 2.0 - Architecture Redesign

This version removes dependencies on:
- WebSocket (replaced with HTTP streaming)
- LangChain (simplified AI integration)
- AWS Bedrock SDK (using Anthropic Claude SDK directly)

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB
- **Cache**: Redis
- **AI**: Anthropic Claude API (direct SDK)

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State**: Zustand
- **Routing**: React Router v7

## Project Structure

```
MFULearnAi/
├── backend/                 # Node.js + Express backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── lib/            # Database & Redis connections
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── app.ts          # Main application file
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml      # Docker Compose configuration
└── deploy.sh              # Deployment script
```

## Quick Start

### Local Development

1. **Install Dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

2. **Environment Setup**

Create `.env` file in the root directory:

```env
# MongoDB
MONGO_PASSWORD=changeme123

# Backend
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-super-secret-session-key
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:80
```

3. **Run with Docker Compose**
```bash
docker-compose up -d
```

4. **Or Run Locally**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Build & Test

### Backend Build Test
```bash
cd backend
npm run build
```

### Frontend Build Test
```bash
cd frontend
npm run build
```

### Docker Build Test
```bash
# Build backend image
docker-compose build backend

# Build frontend image
docker-compose build frontend
```

## Deployment

### Remote Server Setup

Server: `ssh mfulearnai@10.1.44.204`

### Option 1: Using Deployment Script

```bash
# Make script executable
chmod +x deploy.sh

# Deploy
./deploy.sh main
```

### Option 2: Manual Deployment

```bash
# 1. Connect to server
ssh mfulearnai@10.1.44.204

# 2. Navigate to project directory
cd /home/mfulearnai/MFULearnAi

# 3. Pull latest changes
git pull origin main

# 4. Rebuild and restart
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d

# 5. Check logs
docker-compose logs -f
```

## API Endpoints

### Health Check
```
GET /health
```

### Authentication
```
POST /api/auth/register    # Register new user
POST /api/auth/login       # Login
GET  /api/auth/me          # Get current user
```

### Chat
```
POST   /api/chat                  # Create new chat
GET    /api/chat                  # Get all chats
GET    /api/chat/:chatId          # Get chat by ID
POST   /api/chat/:chatId/message  # Send message (non-streaming)
POST   /api/chat/:chatId/stream   # Send message (Server-Sent Events)
PATCH  /api/chat/:chatId/title    # Update chat title
DELETE /api/chat/:chatId          # Delete chat
```

### Admin
```
GET    /api/admin/users           # Get all users
PATCH  /api/admin/users/:userId/role       # Update user role
PATCH  /api/admin/users/:userId/deactivate # Deactivate user
GET    /api/admin/stats           # Get system statistics
```

## Environment Variables

### Required
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection URL
- `JWT_SECRET` - Secret for JWT token signing
- `ANTHROPIC_API_KEY` - Anthropic Claude API key

### Optional
- `PORT` - Backend port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origins
- `ANTHROPIC_MODEL` - Claude model to use (default: claude-3-5-sonnet-20241022)

## Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Check Running Containers
```bash
docker-compose ps
```

## Troubleshooting

### Backend won't start
```bash
# Check MongoDB connection
docker-compose logs db

# Check Redis connection
docker-compose logs redis

# Check backend logs
docker-compose logs backend
```

### Frontend build fails
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### Database connection issues
```bash
# Restart database
docker-compose restart db

# Check database status
docker-compose exec db mongosh --eval "db.adminCommand('ping')"
```

## Security Notes

1. **Change default passwords** in production
2. **Use strong JWT secrets**
3. **Enable HTTPS** with reverse proxy
4. **Limit CORS origins** to your domain
5. **Keep dependencies updated**

## License

Proprietary - Mae Fah Luang University

## Support

For issues and questions, contact the development team.
