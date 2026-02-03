FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files ensuring directory structure
COPY services/logger/package*.json ./services/logger/
COPY shared ./shared

# Install dependencies
WORKDIR /usr/src/app/services/logger
RUN npm install

# Copy source code
COPY services/logger .

# Build
RUN npm run build

EXPOSE 6000
CMD ["npm", "start"]
