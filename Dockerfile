# syntax=docker/dockerfile:1
# Next.js standalone 이미지 (oci-prod는 arm64: docker buildx build --platform linux/arm64 .)
# 실행: node server.js   마이그레이션: node migrate.cjs   Passkey 초대 링크: node passkey-invite.cjs

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci 뒤 postinstall(patch-package)이 패치를 적용한다
COPY patches ./patches
RUN npm ci --no-audit --no-fund

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build \
 && npx esbuild scripts/migrate.ts --bundle --platform=node --format=cjs --outfile=dist/migrate.cjs \
 && npx esbuild scripts/passkey-invite.ts --bundle --platform=node --format=cjs \
      --alias:server-only=./scripts/server-only-stub.mjs --outfile=dist/passkey-invite.cjs

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/dist/migrate.cjs ./migrate.cjs
COPY --from=builder --chown=node:node /app/dist/passkey-invite.cjs ./passkey-invite.cjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
