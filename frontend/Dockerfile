# Stage 1: Build the application
# Use a specific Node.js version for consistency
FROM node:18-alpine AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock, etc.) first
# This leverages Docker's layer caching. `npm install` will only run again
# if these files change.
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application for production
# This generates the `dist` folder
RUN npm run build

# Stage 2: Serve the application using a configured Nginx
FROM nginx:stable-alpine AS production

# Copy the built assets from the 'build' stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration for the frontend server
# This configuration is designed to properly serve a Single Page Application.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the reverse proxy to connect to
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"] 