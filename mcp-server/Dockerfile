# ─── Builder Stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy root workspace package files and configuration
COPY package*.json ./
COPY vite.config.js ./
COPY index.html ./

# Copy directories
COPY src ./src
COPY public ./public
COPY packages/core ./packages/core
COPY mcp-server ./mcp-server

# Install root workspace dependencies
RUN npm ci

# Build core shared package first
WORKDIR /usr/src/app/packages/core
RUN npm ci && npm run build

# Build frontend React dashboard (outputs to /usr/src/app/dist)
WORKDIR /usr/src/app
RUN npm run build

# Build Express server
WORKDIR /usr/src/app/mcp-server
RUN npm ci && npm run build
RUN npm prune --omit=dev

# ─── Production Runner Stage ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /usr/src/app/mcp-server
ENV NODE_ENV=production
ENV PORT=3001

# Copy compiled frontend and backend assets from builder stage
COPY --from=builder /usr/src/app/dist /usr/src/app/dist
COPY --from=builder /usr/src/app/packages/core /usr/src/app/packages/core
COPY --from=builder /usr/src/app/mcp-server/dist /usr/src/app/mcp-server/dist
COPY --from=builder /usr/src/app/mcp-server/node_modules /usr/src/app/mcp-server/node_modules
COPY --from=builder /usr/src/app/mcp-server/package*.json /usr/src/app/mcp-server/

EXPOSE 3001

CMD ["node", "dist/index-http.js"]
