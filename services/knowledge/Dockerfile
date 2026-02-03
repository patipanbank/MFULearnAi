FROM node:20-alpine

WORKDIR /app

# Copy shared types if they exist (optional, handled by build context usually)
# COPY shared ../shared

COPY services/knowledge/package.json ./
COPY services/knowledge/tsconfig.json ./

RUN apk add --no-cache git
RUN npm install

COPY services/knowledge/ ./

RUN npm run build

EXPOSE 7000

CMD ["npm", "start"]
