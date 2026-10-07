# 构建上下文为仓库根目录：docker build -f deploy/caddy/Dockerfile .
# 第一阶段构建前端静态文件，第二阶段由 Caddy 托管并反向代理 /api
FROM node:20-bookworm-slim AS web
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV COREPACK_NPM_REGISTRY=$NPM_REGISTRY npm_config_registry=$NPM_REGISTRY
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @k408/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID
RUN pnpm --filter @k408/web build

FROM caddy:2-alpine
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /app/apps/web/dist /srv
