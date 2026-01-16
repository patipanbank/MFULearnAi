FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files ensuring directory structure
COPY services/auth/package*.json ./services/auth/
COPY shared ./shared

# Install dependencies
WORKDIR /usr/src/app/services/auth
RUN npm install

# Copy source code using the root relative path logic
COPY services/auth .

# Build
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]
