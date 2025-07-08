# -------- Build Stage --------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --silent

COPY . .
RUN npm run build

# -------- Runtime Stage --------
FROM node:20-alpine
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev --silent

EXPOSE 5000
CMD ["node", "dist/main.js"] 