# ---- Builder stage: install deps and compile TypeScript ----
FROM node:20-bookworm-slim AS builder
WORKDIR /build

# Workspace manifests first (better layer caching for npm ci)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Full install (includes devDependencies needed for the build)
RUN npm ci

# Source
COPY shared ./shared
COPY server ./server

# Build shared workspace first (composite project), then server
RUN npm run build -w @fragment/shared \
 && npm run build -w fragment-server

# Strip devDependencies for the runtime image
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-bookworm-slim

# FFmpeg is required by the HLS processing pipeline
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production node_modules + compiled artifacts
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/shared/dist ./shared/dist
COPY --from=builder /build/shared/package.json ./shared/
COPY --from=builder /build/server/dist ./server/dist
COPY --from=builder /build/server/package.json ./server/

# Volume mount points (Fly.io persistent volume target)
RUN mkdir -p /data/uploads/raw /data/uploads/processed

ENV NODE_ENV=production
ENV UPLOAD_DIR_RAW=/data/uploads/raw
ENV UPLOAD_DIR_PROCESSED=/data/uploads/processed

WORKDIR /app/server
EXPOSE 3000
CMD ["node", "dist/index.js"]
