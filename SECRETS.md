# 密钥存放位置说明（不含任何密钥值）

本资料包和 `k408-lab.bundle` 里**没有任何真实密钥**。下面只说明每个密钥是干什么的、现在放在哪里、丢了怎么重新生成。

| 密钥 | 用途 | 现在存放在哪里 | 丢失或泄露时怎么办 |
|---|---|---|---|
| 服务器 SSH 私钥（两把 ed25519） | 以 root 身份登录生产服务器、上传源码包、执行部署脚本 | 只在 Hark 工作区的 `/workspace/.deploy/`（权限 600），没有进入本包 | 本地运行 `ssh-keygen -t ed25519 -f ~/.ssh/k408` 生成新密钥；通过云厂商控制台（VNC 或“重置密钥”功能）把新公钥写进服务器 `/root/.ssh/authorized_keys`，再删掉旧公钥。服务器已经设置为只允许密钥登录（见 `deploy/harden/h2-ssh.sh`），不能用密码登录 |
| 生产环境 `.env`（POSTGRES_PASSWORD、JWT_SECRET 等） | 数据库密码、登录令牌签名密钥 | 只在服务器 `/opt/k408/.env`，以及部署时生成的 `/root/k408.env.v19-*` 备份 | 照着 `deploy/.env.example` 新建一份，用 `openssl rand -hex 24` 生成数据库密码、`openssl rand -hex 32` 生成 JWT_SECRET。更换 JWT_SECRET 会让所有已登录用户需要重新登录；更换数据库密码要同时改数据库里的用户密码 |
| 防扒版权指纹清单（v20 的 fingerprints*.json） | 证明别人的网站是从本站扒走的 | 只在 Hark 工作区 `/workspace/work/v20/`，没有进入本包 | 指纹由源码 `apps/web/build/protect.ts` 确定性生成，有源码就能重算。建议 v21 给指纹加一个只放在服务器上的盐（例如环境变量 `K408_FP_SALT`），这样源码泄露也算不出指纹 |
| GitHub 登录与访问令牌 | 推送代码到私有仓库 `pluto-da/k408-lab` | 你自己的电脑或 GitHub Desktop 里 | 在 GitHub → Settings → Developer settings 里撤销旧令牌，重新生成 |

脚本里的处理：
- `deploy/rx.py`、`deploy/up.py` 原来写死了私钥路径，已改为读环境变量 `K408_SSH_KEY`（默认值是占位符 `<PATH_TO_SSH_PRIVATE_KEY>`）。服务器 IP 保留为默认值，可以用 `K408_HOST` 覆盖。
- 部署脚本里没有写死任何 root 密码。

使用示例：
```bash
export K408_SSH_KEY=~/.ssh/k408      # 你的私钥文件
export K408_TGZ=./k408.tgz           # 打好的源码包
python3 deploy/up.py && sed "s/__BUILD__/v20-xxxxxxx/" deploy/d14.sh | python3 deploy/rx.py
```

**生产数据库备份（服务器 `/var/backups/k408/*.dump`）里有用户个人信息，永远不要上传到 GitHub。**
