# ============================================================
# Udemy Course Finder — Backend Dockerfile
# Multi-stage build for NestJS API
# ============================================================

# ───────────── Stage 1: Build ─────────────
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build && \
    npm prune --omit=dev && \
    find node_modules -type d -name "win32" -path "*/onnxruntime-node/bin/*" -exec rm -rf {} + && \
    find node_modules -type d -name "darwin" -path "*/onnxruntime-node/bin/*" -exec rm -rf {} + && \
    find node_modules -type d -name "arm64" -path "*/onnxruntime-node/bin/*" -exec rm -rf {} + && \
    find node_modules -type d -name "ia32" -path "*/onnxruntime-node/bin/*" -exec rm -rf {} + && \
    find node_modules -type f -name "*cuda.so" -path "*/onnxruntime-node/bin/*" -delete && \
    find node_modules -type f -name "*tensorrt.so" -path "*/onnxruntime-node/bin/*" -delete

# ───────────── Stage 3: Production ─────────────
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install only what's needed for Prisma in production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Startup script: run migrations then start the app
COPY <<'EOF' /app/start.sh
#!/bin/sh
set -e
echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy
echo "Running database seed..."
node_modules/.bin/prisma db seed || echo "Seed skipped (may already be seeded)"
echo "Starting NestJS server..."
node dist/src/main.js
EOF

RUN chmod +x /app/start.sh

EXPOSE 4000

CMD ["/app/start.sh"]
