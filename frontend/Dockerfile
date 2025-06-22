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

# Stage 2: Serve the application using Nginx
# Use a lightweight and secure Nginx image
FROM nginx:stable-alpine AS production

# Copy the built assets from the 'build' stage
COPY --from=build /app/dist /usr/share/nginx/html

# It's good practice to remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx configuration
# This will be handled by the main nginx service in docker-compose,
# so this line is not strictly needed if we build the image separately
# and then the main nginx uses its own config.
# For simplicity and clarity in this new setup, we will let the main nginx service handle configuration.
# The primary purpose of this Dockerfile is to produce the static assets.

# Expose port 80
EXPOSE 80

# The command to start Nginx will be handled by the docker-compose service
CMD ["nginx", "-g", "daemon off;"] 