FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files ensuring directory structure
COPY services/orchestrator/package*.json ./services/orchestrator/
COPY shared ./shared

# Install dependencies
WORKDIR /usr/src/app/services/orchestrator
RUN npm install

# Copy source code
COPY services/orchestrator .

# Build
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
