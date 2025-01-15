# Build stage
FROM node:20-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Clean and verify dist directory
RUN rm -rf dist || true
RUN ls -la

# Build the application
RUN npm run build
RUN ls -la dist || echo "dist directory not found"

# Production stage
FROM nginx:alpine

# Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directory if it doesn't exist
RUN mkdir -p /usr/share/nginx/html

# Copy the build output from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Verify the copy
RUN ls -la /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]