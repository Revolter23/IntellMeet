# ==========================================
# STAGE 1: Build Stage (Node.js)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy client source code and build production assets
COPY . .
RUN npm run build

# ==========================================
# STAGE 2: Production Stage (Nginx Alpine)
# ==========================================
FROM nginx:alpine AS runner

# Copy custom Nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
