FROM node:20-alpine

WORKDIR /usr/src/app/services/knowledge

# Copy package files
COPY services/knowledge/package*.json ./

# Install dependencies
RUN apk add --no-cache git
RUN npm install

# Copy shared types into a local shared directory
COPY shared ./shared

# Copy source code (AFTER npm install to cache layers)
COPY services/knowledge .

RUN npm run build

EXPOSE 7000

CMD ["npm", "start"]
