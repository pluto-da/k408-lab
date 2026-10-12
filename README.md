# 考研408动画实验室 · 全栈 v1

面向考研同学的 408（数据结构 / 计算机组成原理 / 操作系统 / 计算机网络）学习站：
3D 拆开一块主板看考点、11 个可视化实验、3 条流程自动演示、跨科知识连线；
另有「整机拆解」（/pc）：一台写实整机逐个部件拆开看，并附数据旅程演示。账号仅用于登录与昵称。

- 前端：Vite + React 18 + TypeScript + React Router + Zustand + TanStack Query（`apps/web`）
- 后端：Node 20 + Fastify 5 + Prisma 5 + PostgreSQL 16 + zod（`apps/api`）
- 共享：章节/实验/流程目录（`packages/shared`）
- 部署：Docker Compose（Postgres + API + Caddy），Caddy 自动 HTTPS
- 所有库与字体均本地打包，不依赖任何境外 CDN 或字体服务

---

## 目录结构

```
.
├── apps/
│   ├── api/                  # Fastify 接口服务
│   │   ├── prisma/           # schema 与迁移
│   │   ├── src/              # app.ts / routes / lib / plugins
│   │   ├── test/             # 接口集成测试（vitest + 真实 PostgreSQL）
│   │   └── Dockerfile
│   └── web/                  # React 前端
│       ├── legacy-src/    # 旧版实验室模块（原样拆分的脚本、样式、主板模型）
│       ├── public/fonts/     # 本地字体 Geist / Geist Mono
│       └── src/              # 页面、事件桥接、遗留模块加载器
├── packages/shared/          # 前后端共用的目录数据与 zod 校验
├── deploy/caddy/             # Caddyfile 与 Caddy 镜像（内含前端构建）
├── scripts/                  # 备份脚本、旧页面拆分工具、端到端冒烟脚本
├── docker-compose.yml        # 生产部署
├── docker-compose.dev.yml    # 本地开发用数据库
└── .env.example
```

## 功能

| 功能 | 说明 |
| --- | --- |
| 账号 | 用户名或邮箱 + 密码注册/登录（argon2id），会话为 httpOnly Cookie 中的 JWT，退出登录，修改昵称；登录/注册按 IP 限流；手机号短信登录已预留接口（`/api/auth/sms/*` 返回 501，见 `apps/api/src/lib/sms.ts`） |
| 健康检查 | `GET /api/health`（含数据库检查），`GET /api/health/live`（仅进程） |

### 旧版实验室如何接入

v1 不重写 3D 和实验。原单页里的内联脚本和样式被拆成 `apps/web/legacy-src/` 下的独立文件，
`/lab` 页面（`src/pages/Lab.tsx`）把 `body.html` 注入容器后按原顺序串行加载脚本，行为与原页面一致。
主板模型改为直接加载 `legacy/assets/motherboard.glb`（不再用 base64 数据文件）。

旧脚本只能执行一次，所以从 `/lab` 切换到其他页面时会整页加载目标页，以释放 3D 场景。

---

## 本地开发

需要 Node.js ≥ 20.12、pnpm 12（`corepack enable`）以及一个 PostgreSQL 16。

```bash
# 1. 安装依赖
corepack enable          # 或 npm install -g pnpm@12.9.1
pnpm install

# 2. 启动本地数据库（有 Docker 时）
docker compose -f docker-compose.dev.yml up -d postgres

# 3. 环境变量
cp .env.example .env
# 编辑 .env：取消注释并填写 DATABASE_URL=postgresql://k408:k408@localhost:5432/k408
#           JWT_SECRET 随便填一个 32 位以上的字符串
ln -s ../../.env apps/api/.env      # 让 prisma 命令也能读到同一份 .env

# 4. 建表
pnpm db:migrate

# 5. 同时启动前后端
pnpm dev
# 前端 http://localhost:5173 （/api 自动代理到 http://localhost:3000）
```

常用命令：

```bash
pnpm typecheck   # 全部 TypeScript 严格模式类型检查
pnpm lint        # ESLint
pnpm test        # 接口集成测试 + 前端单元测试
pnpm build       # 构建 web 与 api
```

接口测试使用真实的 PostgreSQL：设置了 `TEST_DATABASE_URL` 就用它
（例如 `docker compose -f docker-compose.dev.yml up -d postgres-test` 后设为
`postgresql://k408:k408@localhost:5433/k408_test`）；没设置时会用 `embedded-postgres`
在临时目录自动拉起一个 PostgreSQL 16，跑完即删。测试会先执行 `prisma migrate deploy`，确保测的就是生产迁移脚本。

修改数据库结构：改 `apps/api/prisma/schema.prisma` 后执行
`pnpm --filter @k408/api db:migrate:dev --name 说明` 生成新迁移。

---

## 部署到香港 VPS（2 vCPU / 2–4 GB）

以下以 Ubuntu 22.04 / 24.04 或 Debian 12 为例，全程用 root 或带 sudo 的用户。

### 1. 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
docker compose version          # 确认 Compose v2 可用
```

内存只有 2 GB 时建议加 2 GB swap，避免构建镜像时内存不足：

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. 获取代码

```bash
git clone <你的仓库地址> k408 && cd k408
```

### 3. 配置 .env

```bash
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
nano .env        # 有域名就填 DOMAIN=你的域名；暂时没有域名就留空
```

- `DOMAIN` 留空：用 `http://服务器IP` 访问，不启用 HTTPS（适合先试跑）。
- `DOMAIN` 填写后：Caddy 自动向 Let's Encrypt 申请证书并自动续期，Cookie 自动加 Secure。

### 4. 启动

```bash
docker compose up -d --build
docker compose ps                     # 三个服务都应为 running / healthy
curl http://127.0.0.1/api/health      # {"status":"ok","db":"ok",...}
```

首次构建需要几分钟。API 容器启动时会自动执行数据库迁移，并同步题库、流程等种子数据。

### 5. 设置 DNS A 记录

在域名服务商处添加 A 记录：主机记录 `@`（或子域名如 `408`）→ 服务器公网 IP。
等解析生效（`ping 你的域名` 能看到服务器 IP）后，把域名写进 `.env` 的 `DOMAIN`，然后：

```bash
docker compose up -d        # 只会重建 api/caddy 的配置，数据不丢
```

### 6. HTTPS 自动生效

确保云服务商安全组/防火墙放行 **80、443（TCP）以及 443（UDP）** 端口。
Caddy 会在第一次访问时自动签发证书，并把 http 自动跳转到 https。证书保存在 `caddy_data` 数据卷中。
查看签发日志：`docker compose logs -f caddy`。

> 服务器在香港，无需 ICP 备案即可用域名访问。

### 更新版本

```bash
git pull
docker compose up -d --build
```

---

## 备份与恢复

备份（在仓库根目录执行，生成 `backups/k408-时间.sql.gz`，自动保留最近 14 份）：

```bash
./scripts/backup-db.sh
```

等价的单条命令：

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' | gzip > backups/k408-$(date +%F).sql.gz
```

每天凌晨 4 点自动备份（`crontab -e`）：

```
0 4 * * * cd /root/k408 && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

恢复：

```bash
gunzip -c backups/k408-20261008-040000.sql.gz | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

建议把 `backups/` 定期同步到服务器以外的地方（对象存储或本地电脑）。

---

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（含数据库） |
| POST | `/api/auth/register` | `{ username?, email?, password, nickname? }`，用户名与邮箱至少一个 |
| POST | `/api/auth/login` | `{ account, password }`，account 为用户名或邮箱 |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/sms/send`、`/api/auth/sms/login` | 预留，返回 501 |
| POST | `/api/auth/logout-all` | 退出所有设备（`tokenVersion` +1，所有旧会话失效） |
| GET / PATCH | `/api/me` | 当前用户 / 修改昵称 |
| DELETE | `/api/me` | `{ password }`，注销账号（立即删除） |

## 安全说明

- 密码使用 argon2id（19 MiB / t=2）哈希；登录失败对“账号不存在”和“密码错误”返回相同提示。
- 会话 Cookie：httpOnly、SameSite=Lax，HTTPS 下带 Secure；写请求若带 Origin 必须与站点同源。
- 登录/注册每 IP 每分钟默认 60 次（`AUTH_RATE_LIMIT_MAX`，宿舍/校园网常共用出口 IP），同一账号连续输错 10 次锁定 15 分钟，其余接口每 IP 每分钟 300 次。
- Caddy 下发 CSP 等安全响应头，所有脚本均为本站文件。
