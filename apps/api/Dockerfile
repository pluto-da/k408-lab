# 构建上下文为仓库根目录：docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS base
ARG APT_MIRROR=
RUN if [ -n "$APT_MIRROR" ]; then sed -i "s#http://deb.debian.org#$APT_MIRROR#g" /etc/apt/sources.list.d/debian.sources; fi
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# 可通过 --build-arg NPM_REGISTRY=https://registry.npmmirror.com 使用镜像源
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=$NPM_REGISTRY
ARG PRISMA_ENGINES_MIRROR=
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
RUN npm install -g pnpm@12.9.1 && pnpm --version
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @k408/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @k408/api build \
  && pnpm --filter @k408/api deploy --prod /out \
  && cd /out && ./node_modules/.bin/prisma generate

FROM node:20-bookworm-slim AS runtime
ARG APT_MIRROR=
RUN if [ -n "$APT_MIRROR" ]; then sed -i "s#http://deb.debian.org#$APT_MIRROR#g" /etc/apt/sources.list.d/debian.sources; fi
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/prisma ./prisma
COPY --from=build --chown=node:node /out/dist ./dist
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
