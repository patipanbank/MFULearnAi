FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files ensuring directory structure
COPY services/knowledge/package*.json ./services/knowledge/
COPY shared ./shared

# Install dependencies
WORKDIR /usr/src/app/services/knowledge
RUN apk add --no-cache git
RUN npm install

# Copy source code (AFTER npm install to cache layers)
COPY services/knowledge .

RUN npm run build

EXPOSE 7000

CMD ["npm", "start"]
