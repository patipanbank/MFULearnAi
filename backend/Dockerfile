# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files first to leverage cache
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

WORKDIR /app/backend
# Install dependencies (cached unless package.json changes)
RUN npm install --legacy-peer-deps

# Copy source code after install
WORKDIR /app
COPY shared/ ./shared/
COPY backend/ ./backend/

WORKDIR /app/backend
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY backend/package*.json ./
RUN apk add --no-cache git && \
    npm install --omit=dev --legacy-peer-deps && \
    apk del git

# Copy built assets (tsconfig rootDir=".." means output is dist/backend/src and dist/shared)
# We copy from builder /app/backend/dist to /app/dist
COPY --from=builder /app/backend/dist ./dist

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Healthcheck — uses readiness probe (checks Redis connectivity)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:8080/health/ready || exit 1

# Support graceful shutdown
STOPSIGNAL SIGTERM

EXPOSE 8080

# Start command - adjusted path based on dist structure
CMD ["node", "dist/backend/src/index.js"]
