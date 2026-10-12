# 构建上下文为仓库根目录：docker build -f deploy/caddy/Dockerfile .
# 第一阶段编译带频率限制插件的 Caddy；第二阶段构建前端静态文件；第三阶段由 Caddy 托管并反向代理 /api

# ---- 1. 自定义 Caddy（caddy-ratelimit 插件）。国内服务器可设 GOPROXY=https://goproxy.cn,direct
FROM caddy:2-builder-alpine AS caddy-build
ARG GOPROXY=https://proxy.golang.org,direct
ENV GOPROXY=$GOPROXY
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

# ---- 2. 前端
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
# 混淆旧版模块需要较多内存（约 1 GB）
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm --filter @k408/web build \
  && test -z "$(find apps/web/dist -name '*.map')" \
  && test ! -e apps/web/dist/legacy/manifest.json

# ---- 3. 运行：非 root 用户（uid 10001），配置在构建时校验
FROM caddy:2-alpine
COPY --from=caddy-build /usr/bin/caddy /usr/bin/caddy
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /app/apps/web/dist /srv
# 去掉二进制上的文件能力（cap_net_bind_service）：容器设置了 no-new-privileges 且 cap_drop ALL，带文件能力的程序会 exec 失败
# 监听 80/443 靠 compose 里的 net.ipv4.ip_unprivileged_port_start=0
RUN cp /usr/bin/caddy /tmp/caddy && rm -f /usr/bin/caddy && mv /tmp/caddy /usr/bin/caddy && chmod 755 /usr/bin/caddy \
  && caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  && addgroup -S -g 10001 web && adduser -S -D -H -u 10001 -G web web \
  && mkdir -p /data/caddy /data/logs /config/caddy \
  && chown -R 10001:10001 /data /config
USER 10001:10001
