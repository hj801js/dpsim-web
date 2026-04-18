# Multi-stage Next.js production image.
# Builds the standalone output (emitted when `output: "standalone"` is set in
# next.config.ts) and runs it under a minimal node alpine runtime.
#
#   docker build -t dpsim-web .
#   docker run --rm -p 3000:3000 -e DPSIM_API_URL=http://dpsim-api:8000 dpsim-web

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Snapshot codegen uses src/lib/openapi.snapshot.json — no live backend needed.
RUN npm run gen:types:snapshot
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Non-root to satisfy baseline container scanners.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
