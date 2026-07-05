FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g npm@11.6.2

COPY package*.json ./
COPY prisma ./prisma
RUN NODE_ENV=development npm ci

COPY . .

ENV SKIP_ENV_VALIDATION=true
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN npm install -g npm@11.6.2

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src

EXPOSE 3000

# Startup policy is environment-aware:
# - non-prod can keep `KONTAX_SCHEMA_MODE=push`
# - production should use `KONTAX_DEPLOY_ENV=production` (and NODE_ENV=production
#   also defaults to validate if KONTAX_DEPLOY_ENV is missing)
CMD ["node", "scripts/start-production.mjs"]
