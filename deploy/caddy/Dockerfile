# 构建上下文为仓库根目录：docker build -f deploy/caddy/Dockerfile .
# 第一阶段构建前端静态文件，第二阶段由 Caddy 托管并反向代理 /api
FROM node:20-bookworm-slim AS web
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=$NPM_REGISTRY
RUN npm install -g pnpm@12.9.1 && pnpm --version
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @k408/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID
# 站点根地址（https://域名），用于生成 sitemap.xml；ICP 备案号显示在页脚
ARG SITE_URL=
ENV SITE_URL=$SITE_URL
ARG VITE_ICP_BEIAN=
ENV VITE_ICP_BEIAN=$VITE_ICP_BEIAN
# 运营者联系邮箱，显示在用户协议与隐私政策中
ARG VITE_CONTACT_EMAIL=
ENV VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL
RUN pnpm --filter @k408/web build

FROM caddy:2-alpine
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /app/apps/web/dist /srv
