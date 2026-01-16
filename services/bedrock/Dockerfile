FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files ensuring directory structure
COPY services/bedrock/package*.json ./services/bedrock/
COPY shared ./shared

# Install dependencies
WORKDIR /usr/src/app/services/bedrock
RUN npm install

# Copy source code
COPY services/bedrock .

# Build
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
