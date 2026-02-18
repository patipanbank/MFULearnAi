# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy shared and backend
COPY backend/package*.json ./backend/
COPY shared/ ./shared/
COPY backend/ ./backend/

WORKDIR /app/backend
# Install dependencies
RUN npm install --legacy-peer-deps

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

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- http://localhost:8080/health || exit 1

EXPOSE 8080

# Start command - adjusted path based on dist structure
CMD ["node", "dist/backend/src/index.js"]
