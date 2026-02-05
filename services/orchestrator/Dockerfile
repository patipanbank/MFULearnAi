FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files ensuring directory structure
COPY services/orchestrator/package*.json ./services/orchestrator/
COPY shared ./shared

# Install dependencies
WORKDIR /usr/src/app/services/orchestrator
RUN npm install

# Copy source code
COPY services/orchestrator .

# Verify Source is New (Fail build if old)
RUN grep "x-correlation-id" src/services/BedrockService.ts || (echo "Old Code Detected!" && exit 1)

# Build
RUN rm -rf dist && npm run build

EXPOSE 8080
CMD ["npm", "start"]
