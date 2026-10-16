# Built from the repo root: docker build -f apps/api/Dockerfile .
FROM oven/bun:1.3.14-slim
WORKDIR /app

# Every workspace's package.json, so the lockfile matches (same list as apps/meta-emulator/Dockerfile); only the API's production dependencies are installed.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/meta-emulator/package.json apps/meta-emulator/
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/theme/package.json packages/theme/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN bun install --frozen-lockfile --production --filter @acme/api

COPY packages/db packages/db
COPY apps/api apps/api

EXPOSE 3000
# Migrations run on every deploy, before the API listens.
CMD ["sh", "-c", "cd packages/db && bun run db:migrate:deploy && cd /app && exec bun apps/api/src/index.ts"]
