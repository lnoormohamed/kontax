FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g npm@11.6.2

COPY package*.json ./
COPY prisma ./prisma
RUN NODE_ENV=development npm ci

COPY . .

ENV SKIP_ENV_VALIDATION=true
RUN npm run build

# Drop devDependencies (eslint, typescript, playwright, tailwind, …) from the
# image we ship, but restore the Prisma CLI: scripts/runtime/start-production.mjs
# and scripts/runtime/check-schema-drift.mjs shell out to `npx prisma db push`
# / `prisma migrate diff` at container boot, and `prisma` (unlike
# `@prisma/client`) is a devDependency. Pin it to the same range package.json
# declares so the CLI and the generated client never drift apart.
RUN npm prune --omit=dev \
  && npm install --no-save "prisma@$(node -p "require('./package.json').devDependencies.prisma")"

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN npm install -g npm@11.6.2

# Only what the running server, the Prisma client, and the boot scripts need —
# no src/, no dev tooling, no seed/admin scripts, no repo docs. generated/
# comes from the builder's Linux `prisma generate` output, never from the repo.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/scripts/runtime ./scripts/runtime
# next.config.js does `import "./src/env.js"`, and Next re-loads next.config.js
# (via dynamic import, not the webpack bundle) on every server start — not
# just at `next build` — so this one file is a genuine runtime dependency,
# confirmed by booting the pruned image layout with/without it. It only
# imports @t3-oss/env-nextjs + zod (already in node_modules); nothing else
# under src/ is needed.
COPY --from=builder /app/src/env.js ./src/env.js

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Startup policy is environment-aware:
# - non-prod can keep `KONTAX_SCHEMA_MODE=push`
# - production should use `KONTAX_DEPLOY_ENV=production` (and NODE_ENV=production
#   also defaults to validate if KONTAX_DEPLOY_ENV is missing)
CMD ["node", "scripts/runtime/start-production.mjs"]
