# Build stage
FROM node:20-alpine AS build

# Build arguments
ARG VITE_API_URL=https://mfulearnai.mfu.ac.th
ARG VITE_WS_URL=wss://mfulearnai.mfu.ac.th/ws

# Set environment variables for build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Set working directory
WORKDIR /app/frontend

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the build output from the build stage
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 