FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .



# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (use npm install to sync lock file)
RUN npm install --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy source files for workers (needed for ts-node)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig*.json ./

# Install ts-node for running workers
RUN npm install -g ts-node

# Expose port
EXPOSE 3001

# Start the application (can be overridden for workers)
CMD ["npm", "start"] 