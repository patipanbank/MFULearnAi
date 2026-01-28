FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
# Increase timeout and use npm install (more robust than ci if lockfile missing/mismatch)
RUN npm config set fetch-retry-maxtimeout 1200000 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm install

COPY . .
RUN npm run build

FROM nginx:alpine AS production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
