# ==========================================
# STAGE 1: Dependency & Build Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy server application files
COPY . .

# Prune development dependencies to keep production footprint minimal
RUN npm prune --production

# ==========================================
# STAGE 2: Lightweight Production Runtime
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests and pruned node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/database ./database
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services

# Security best practice: Run application as non-root user
USER node

EXPOSE 3000

CMD ["node", "index.js"]
