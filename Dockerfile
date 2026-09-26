FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/saturon/package.json ./packages/saturon/
COPY apps/docs/package.json ./apps/docs/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter saturon build
RUN pnpm --filter saturon-docs build

EXPOSE 3000
CMD ["pnpm", "--filter", "saturon-docs", "start"]