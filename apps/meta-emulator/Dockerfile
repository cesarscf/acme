# Built from the repo root: docker build -f apps/meta-emulator/Dockerfile .
FROM oven/bun:1.3.14-slim
WORKDIR /app

# Every workspace's package.json, so the lockfile matches (same list as apps/api/Dockerfile); dev dependencies stay, since Vite builds the web screen.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/meta-emulator/package.json apps/meta-emulator/
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/theme/package.json packages/theme/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN bun install --frozen-lockfile --filter @acme/meta-emulator

COPY packages/theme packages/theme
COPY packages/typescript-config packages/typescript-config
COPY apps/meta-emulator apps/meta-emulator
RUN cd apps/meta-emulator && bun run build

EXPOSE 4000
CMD ["bun", "apps/meta-emulator/src/server/index.ts"]
