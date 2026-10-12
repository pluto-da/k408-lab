---
title: 考研408动画实验室 · 全量打包推送到 GitHub 私有仓库 · 执行 Prompt
date: 2026-10-12
---

# 考研408动画实验室：全量打包推送到 GitHub 私有仓库（执行 Prompt）

> 本文件是给执行代理的完整任务说明。盘点数据采集于 2026-10-12 16:15 前后（北京时间），全部来自只读命令。执行前请先做第 5 节“步骤 0 预检”，因为 v20 任务那时仍在仓库里改代码，有些数字可能已经变了。
> 本 Prompt 只负责规划。真正执行时必须遵守第 12 节“需用户决定的事项”里用户的选择；用户没答复的项，按每项给出的默认值执行。

---

## 1. 需求剖析：用户说的“全部”到底是什么

用户原话：“把这个项目全部打包放到 GitHub 上，私密。是全部哦。”这句话里有三层意思：

1. **私密**：仓库必须是 private，只有用户本人能看到。不能先建成公开再改私有，也不能有任何一刻处于公开状态。
2. **“全部”是重点**：用户特意强调“是全部哦”，可见他担心我们只推一份精简过的源码。按这个项目的实际情况，“全部”至少包括以下内容：
   - 主代码仓库 `/workspace/fullstack-408` 的**完整 git 历史**：所有提交、所有分支，并把各个版本号（v1、v6 到 v20）打成标签，方便回到任意一版；
   - 部署配置：docker-compose、Caddy、Dockerfile、CI 工作流、`.env.example`，还有仓库外的部署脚本历史（`/workspace/.deploy/` 里的 d2 到 d14、回滚脚本、harden 服务器加固脚本）；
   - 过程资料：每一版的需求 Prompt（md/docx）、审计报告、v20 安全审计输出、截图和对比图、调试脚本；
   - 宣传视频：成片（16:9 和 9:16）、封面、旁白、配乐、分镜脚本和合成脚本；
   - 3D 模型的生成工具和产物（`tools/pc-model` 的源码已经在仓库里；它的 build 产物有 261 MB，被 .gitignore 忽略了）。
3. **能完整复原、能重新部署**：拿到仓库的人（包括半年后的用户自己，或者换一台机器的 Hark）只靠 GitHub 上的内容，就要能装好依赖、构建、测试、部署上线，并且查得到每个版本当时为什么那样改。

和“全部”冲突的是**安全**。私有仓库照样有泄露的可能：GitHub 账号被盗、OAuth 授权被滥用、日后误改成公开、协作者或第三方应用读取了仓库。SSH 私钥一旦泄露，等于服务器的 root 权限拱手让人；生产数据库密码和 JWT 密钥泄露了，可以伪造任意用户的登录；防扒指纹泄露了，指纹就失去了取证作用。所以本方案的原则是：

- **能入库的全部入库**：代码、历史、文档、脚本、Prompt、报告、成片；
- **大文件换个地方放，但仍在 GitHub 上**：过程截图、音频、实验模型等大体积素材放进 Release 附件（不占 LFS 额度，单个文件小于 2 GiB），最终交付物放进 Git LFS；
- **密钥绝不明文入库**：默认根本不入库，只入一份说明“密钥在哪里、怎么重新生成”的文档；用户若想要真正意义上的“全部”，可以选择用 age 加密后入库，口令存进 Hark 保险库。
- **与本项目无关的东西不进来**：工作区根目录里的爆款小游戏封图、arcade、其他网站、用户上传的版权教材 PDF、日历数据、Hark 自己的记忆和系统目录。

---

## 2. 现状盘点结果（真实数字，只读采集）

### 2.1 主仓库 `/workspace/fullstack-408`

| 项目 | 数值 |
|---|---|
| 目录总体积（du） | 788 MB |
| 其中 `node_modules`（根目录） | 425 MB；另有 `apps/web/node_modules` 14 MB、`apps/api/node_modules` 83 KB |
| 构建产物 `apps/web/dist` | 26 MB；`apps/api/dist` 21 KB |
| `tools/` | 262 MB，其中 `tools/pc-model/build/` 261 MB（单个 .ply 最大约 16.7 MB，.glb 最大约 9.1 MB），已被 `tools/pc-model/.gitignore` 忽略 |
| `.git` | 38 MB；`git count-objects -vH`：993 个松散对象、36.37 MiB，没有 pack |
| 提交数 | 24（`git log --oneline \| wc -l`）；只有一个分支 `master`，**没有标签、没有远程、没有 stash** |
| 历史里的对象 | 639 个 blob（原始体积 54.1 MiB）、319 个 tree、24 个 commit；最大的 blob 是 `apps/web/public/legacy/assets/motherboard.glb`，2.67 MB |
| HEAD 跟踪的文件 | 257 个；其中媒体和模型（glb/sog/png/webp/woff2 等）63 个，共 22.0 MiB |
| 大于 50 MB 的跟踪文件 | **0 个**（历史里也没有），推送不会触发 GitHub 的大小限制 |
| 提交身份 | `k408-dev <dev@k408.local>`（仓库级配置）。GitHub 不会把这些提交关联到用户账号，但不影响使用，**不要改写历史** |
| 工作区状态（采集时） | v20 正在进行：53 处已暂存的改动（主要是 `apps/web/public/legacy` 改名为 `apps/web/legacy-src`），63 个文件已修改未暂存，3 个未跟踪（`apps/web/build/protect.ts`、`apps/web/scripts/audit-ui.cjs`、`apps/web/scripts/site-audit.cjs`） |
| .gitignore | 忽略 node_modules、dist、coverage、.env、.env.*（保留 .env.example）、*.log、apps/api/.tmp-pg/、backups/ |
| CI | `.github/workflows/ci.yml`：每次 push 都会在 ubuntu-latest 上起 Postgres 16，依次跑 install、typecheck、lint、test、build |

版本号和提交的对应关系（来源是部署脚本里的 `BUILD_ID=` 和提交说明，可以直接用来打标签）：

| 标签 | 提交 | 标签 | 提交 |
|---|---|---|---|
| v1 | 7203144 | v13 | c19bcc9 |
| v6 | cb3a0e3 | v14 | 29c18e5 |
| v7 | 52f5657 | v15 | 71dd65f |
| v8 | dcc02e6 | v16 | 514658c |
| v9 | e5e2fef | v17 | 19f8daf |
| v10 | 3330c2f | v17a | 7ae56fb |
| v11 | 2118532 | v18 | 516667f |
| v12 | 48fde11 | v19 | 20912bb |

v2 到 v5 在提交说明里没有明确对应，不要硬凑标签。v20 等 v20-finish 提交后，按它的提交号补上。

### 2.2 周边目录

| 路径 | 体积 | 内容与判断 |
|---|---|---|
| `/workspace/.deploy/` | 96 KB | **2 把 OpenSSH 私钥**（`hark_408`、`id_ed25519`）和对应公钥；部署脚本 d.sh、d2 到 d14、d14-rollback.sh、e.sh；`harden/` 下 7 个服务器加固脚本（SSH 只允许密钥登录、ufw、fail2ban、每日备份 cron、恢复演练）；`rx.py`/`up.py`（paramiko 脚本，写死了服务器 IP、用 root 登录、私钥路径）；`k408.tgz`（66 KB，上一次上传用的源码包）；`deleted.txt` |
| `/workspace/work/` | 913 MB | 不含 node_modules 共 3688 个文件、849.1 MiB。按类型：PNG 1823 个 327.2 MiB、WAV 31 个 130.3 MiB、GLB 105 个 126.5 MiB、JPG 412 个 65.2 MiB、MP4 8 个 61.5 MiB、ONNX 1 个 60.3 MiB、JS 337 个 29.9 MiB、WebP 177 个 15.8 MiB。另有 `work/gltf/node_modules` 75 MB、`work/pw/node_modules` 14 MB |
| 其中各版本 Prompt | — | 根目录 17 个 `*-prompt.md`/调研 md、13 个 docx（cn、coos、ds、proc、prop、redesign、ride、ride-layout、ride-ui、rwd、src、toc、todo、pc-orbit、final-check-security、splat-research 等） |
| 其中报告 | — | `audit.md`、`promo/REPORT.md`、`rwd/REPORT.md`、`rwd-react/REPORT.md`、`todo-r17/audit/report.md`、`v19/rwd/report.md`、`v20/site0/report.md` 等 |
| 其中 dist 前后对比副本 | 约 102 MiB | `rwd/dist-before|after`、`toc/dist-before|after`、`v16/live`、`v17/live` 等，可从对应提交重新构建，属于冗余 |
| `work/v20/` | 采集时 38 项 | v20 审计输出、`fingerprints.json` 和 `fingerprints-test.json`（各 6 条指纹）、截图、日志。**v20-finish 仍在往里写文件**（采集期间看到 tb/、ui/ 下有新文件） |
| `work/promo/` | 363 MB | build 160 MB（合成中间分块）、shots 77 MB、voices 61 MB（`zh_CN-huayan-medium.onnx` 60.3 MB，第三方 Piper 语音模型，可重新下载）、qa 11 MB、music 9.2 MB、explore 8.1 MB、tts 5.0 MB；**成片 `promo-16x9.mp4` 24.7 MB、`promo-9x16.mp4` 7.6 MB**，封面 2 张，脚本 compose.py、build_timeline.py、mix.py、music.py、cover.py、cap-*.cjs，`narration.json`，`promo-prompt.md/.docx` |
| `work/promo2/` | 16 KB | 今天 16:14 刚建的，只有 `vt-probe.cjs` 和 `browsers/`，应该是另一个宣传视频任务正在进行。执行时再看一眼，成品出来了就一起归档 |
| `/workspace/files/uploads/` | 819 MB | **4 本王道 2027 教材 PDF**（188.3、199.5、202.3、225.0 MB，每本都超过 GitHub 100 MB 的单文件上限，而且是有版权的出版物）；另有几张手机照片和截图 |
| 根目录杂项 | 约 13 MB | `cover_*.png`、`girlfriend_pov.png`、`hero_arcade.png`、`arcade/`（580 KB）属于爆款小游戏等其他项目，**和 408 无关** |
| `/workspace/built/` | 11 MB | sites 9.6 MB（5 个站点）、widgets 646 KB。执行时逐个确认是否属于 408，不属于就排除 |
| `/workspace/deploy/vendor/` | 722 KB | 早期的 three.js vendor 文件，已被仓库内的版本取代，可以归档进 archive |
| `.pnpm-store/` | 386 MB | pnpm 缓存，**不入库** |
| `.trash/`、`.hark/`、`memory/` | — | 系统目录、回收站、Hark 记忆，**一律不入库** |

### 2.3 大文件清单

- **大于 100 MB（GitHub 直接拒收）**：4 个，全是 `files/uploads/` 里的教材 PDF。
- **50 到 100 MB（会收到警告）**：1 个，`work/promo/voices/zh_CN-huayan-medium.onnx`（60.3 MB）。
- **20 到 50 MB**：`work/promo/promo-16x9.mp4`（24.7 MB）；`.trash` 里的临时文件不算。
- 主仓库 git 历史中**没有**超过 3 MB 的文件。

### 2.4 工具环境

- 架构 aarch64；git 2.47.3；node v22.23.3；pnpm 12.9.1；zstd、tar 可用；**没有 rsync，没有 ssh 客户端**（有 apt-get，也有 python paramiko 5.0.0）。
- git-lfs 没装，arm64 版 v3.5.1 可以从 GitHub Releases 下载解压后直接用（已验证）。
- age v1.2.1 arm64 可以下载使用（已验证）。
- gitleaks 8.21.2 arm64 可以下载使用（已验证，本次扫描就是用它跑的）。

---

## 3. 风险清单

| 编号 | 风险 | 位置 | 严重度 | 处理 |
|---|---|---|---|---|
| R1 | SSH 私钥（能以 root 登录生产服务器） | `/workspace/.deploy/hark_408`、`/workspace/.deploy/id_ed25519` | 致命 | 默认不入库；可选 age 加密入库 |
| R2 | 服务器 IP 加 root 用户名写死在脚本里 | `.deploy/rx.py`、`.deploy/up.py`；另外约 40 个 work 文件（Prompt、cap-*.cjs、promo 脚本、报告）里也出现了 IP；**git 历史里 0 处** | 中 | 归档脚本改成读环境变量 `K408_HOST`、`K408_SSH_KEY`；文档里的 IP 默认保留（仓库私有，服务器已改为只允许密钥登录，并装了 fail2ban 和 ufw），见 12 节说明 |
| R3 | 生产 `.env`（POSTGRES_PASSWORD、JWT_SECRET 等） | **只在服务器的 `/opt/k408/.env` 和 `/root/k408.env.v19-*` 备份里**，工作区没有 | 致命 | 默认不入库；只有选了加密入库时才通过 SSH 拉下来加密 |
| R4 | 防扒版权指纹 | `work/v20/fingerprints.json`、`fingerprints-test.json` | 中 | 注意：`apps/web/build/protect.ts` 里的指纹是用 `sha256("k408-fp\|v1\|"+kind)` **确定性生成**的，有源码就能算出全部指纹。所以私有仓库里的源码本身已经等于指纹清单，单独排除这个 json 意义有限。默认把它放进加密包（或不入库），并在文档里建议 v21 给指纹加一个只存在服务器上的盐 `K408_FP_SALT` |
| R5 | 个人数据 | `work/cal.json`、`work/brief/cals.json`、`work/brief/callist.json`（用户的 Google 日历数据，gitleaks 命中了其中的 nextSyncToken）；`.deploy/e.sh` 里有用户邮箱（网站本来就公开展示它，可以保留） | 中 | 日历文件排除 |
| R6 | 版权教材 PDF | `files/uploads/*.pdf`，4 本共 815 MB | 中（版权和体积） | 默认不上传 |
| R7 | 生产数据库数据 | 服务器 `/var/backups/k408/*.dump` | 高（个人信息保护法） | **永远不入库**，也不提供选项 |
| R8 | 推送通道没有写权限 | 见第 8 节：凭据网关能注入身份，但对已有仓库的 receive-pack 返回 403 | 阻断 | 推送前必须先解决授权 |
| R9 | 和 v20-finish 并发 | v20 任务正在改工作区、往 `work/v20` 写文件、部署 | 高 | 等 v20 提交并部署完再推；全程不碰原仓库的文件、分支和配置 |
| R10 | 推送会触发 CI | `ci.yml` 在 push 时运行，私有仓库每月有 2000 分钟免费额度 | 低 | 正常，首次运行结果要看；失败了只记录，不要为了 CI 修改代码 |
| R11 | 推送 `.github/workflows/` 需要专门的权限 | OAuth 需要 `workflow` scope，GitHub App 需要 Workflows: write | 中 | 申请授权时一并申请 |
| R12 | 单条命令 120 秒上限 | 大文件上传、LFS 推送、pnpm install | 中 | 分块上传（每块 ≤150 MB），逐批推送，离线安装 |
| R13 | 已经被扫描到的历史泄露 | gitleaks 扫描了 24 个提交和当前工作树：**0 处发现** | 无 | 推送前在暂存副本里再扫一遍 |

---

## 4. 目标仓库结构

一个私有仓库：**`pluto-da/k408-lab`**（GitHub 账号 `pluto-da`，名字可以改）。

```
pluto-da/k408-lab (private)
├── 分支 master            ← 和本地 /workspace/fullstack-408 的 master 逐个提交完全一致（含 v20），不做任何改写
├── 分支 archive（孤儿分支） ← 周边资料，和代码历史互不干扰
│   ├── README.md          ← 总索引：这个仓库里有什么、怎么复原、怎么部署、密钥在哪
│   ├── RESTORE.md         ← 从零复原并部署的手册（命令级）
│   ├── SECRETS.md         ← 每个密钥的用途、存放位置、如何轮换和重新生成（不含任何值）
│   ├── .gitattributes     ← LFS 规则
│   ├── prompts/           ← work/*-prompt.md|docx、splat-research.md、promo-prompt.*、github-prompt.*
│   ├── reports/           ← audit.md、各 REPORT.md/report.md、v20 审计报告（不含指纹 json）
│   ├── scripts/           ← work 根目录的 *.cjs/*.mjs/*.py/*.sh 调试和截图脚本，各版本子目录里的脚本
│   ├── deploy-history/    ← .deploy/*.sh、harden/*.sh、rx.py/up.py（已脱敏，改读环境变量）、deleted.txt
│   ├── promo/             ← 视频脚本、narration.json、封面、成片 mp4（LFS）
│   ├── legacy-vendor/     ← /workspace/deploy/vendor
│   ├── secrets/           ← 只有用户选了“加密入库”才有：k408-secrets.tar.age
│   └── MANIFEST.sha256    ← archive 里每个文件和每个 Release 附件的 SHA256
├── 标签 v1, v6 … v19, v17a, v20（附注标签，指向 master 上的提交）
└── Release “archive-2026-10-12”（附件，不占 LFS 额度）
    ├── work-shots.tar.zst.partNN          ← shots/、shots-*/、v15 到 v20 截图、rwd/、toc/ 等过程截图
    ├── work-media.tar.zst.partNN          ← promo/build、shots、tts、music、qa、explore、wav
    ├── work-models.tar.zst.partNN         ← work/gltf、pcb3d、splat 等实验模型（不含 node_modules）
    ├── pc-model-build.tar.zst.partNN      ← tools/pc-model/build（261 MB，可重新生成，但也备一份）
    ├── work-dist-snapshots.tar.zst.partNN ← 各个 dist-before/after 副本（可选，约 102 MiB）
    └── SHA256SUMS
```

为什么这样设计：

- **master 保持和本地一致**：以后每一版只要 `git push` 就能快进同步，永远不会冲突；也不需要在 v20 任务进行时动原仓库。
- **资料放孤儿分支而不是另开一个仓库**：用户只需记住一个仓库，“全部”都在同一个地方；`git clone` 默认检出 master，不会把 archive 的 LFS 大文件一起下载。
- **Release 放大体积过程素材**：GitHub 官方文档说明 Release 附件不限总大小、不限带宽，单个文件只要小于 LFS 的单文件上限（Free 计划 2 GB）；LFS 的免费额度（Free 计划 10 GiB 存储，每月 10 GiB 下载带宽）留给真正需要随仓库检出的成片。来源：https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github ，https://docs.github.com/en/billing/concepts/product-billing/git-lfs 。注意：用户说的“LFS 免费 1 GB”是旧额度，现行文档是 10 GiB。

**明确不入库的内容**（写进 archive/README.md 的“未包含”一节，让用户知道它们在哪）：所有 node_modules、dist、`.pnpm-store`、`.trash`、`.hark`、`memory/`；4 本教材 PDF（除非用户另选）；日历 json；ONNX 语音模型（README 里写明下载地址和文件名，可重新获取）；根目录的其他项目文件；生产数据库备份；明文密钥。

---

## 5. 详细执行步骤（命令级）

> 约定：工作目录统一用 `/workspace/work/github/`。所有访问 GitHub 的 shell 调用都带上 `credentials: [{"provider":"github"}]`。每条命令控制在 120 秒内；同一步失败两次就停下，向用户报告。**全程不在 `/workspace/fullstack-408` 里执行任何写操作**，只读 git 命令一律加 `GIT_OPTIONAL_LOCKS=0`，避免刷新 index。

### 步骤 0：预检（等 v20 完成）

```bash
cd /workspace/fullstack-408
export GIT_OPTIONAL_LOCKS=0
git log --oneline -3                 # 期望最新一条是 v20 的提交
git status --porcelain | wc -l       # 期望 0；不是 0 说明 v20 还没提交完，等待
git stash list | wc -l               # 期望 0
find /workspace/fullstack-408 /workspace/work/v20 -newermt '-10 minutes' -type f \
  -not -path '*/node_modules/*' | head    # 期望没有输出：10 分钟内没有人在写
```

满足以上条件，并且（如果能看到的话）v20 部署日志里出现了 `D14_DONE 0`，才继续往下做。不满足就等待，每 10 分钟查一次，最多等 2 小时，超时向用户报告。如果用户选了“先推当前、再增量同步”（见 12 节第 3 项），可以跳过“工作区干净”这一条：mirror 克隆只读取已提交的对象，不受未提交改动影响。

### 步骤 1：准备工具

```bash
mkdir -p /workspace/work/github/bin && cd /workspace/work/github/bin
curl -sSL -m 60 -o gl.tgz https://github.com/gitleaks/gitleaks/releases/download/v8.21.2/gitleaks_8.21.2_linux_arm64.tar.gz && tar xzf gl.tgz gitleaks
curl -sSL -m 60 -o lfs.tgz https://github.com/git-lfs/git-lfs/releases/download/v3.5.1/git-lfs-linux-arm64-v3.5.1.tar.gz && tar xzf lfs.tgz && cp git-lfs-3.5.1/git-lfs .
curl -sSL -m 60 -o age.tgz https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-arm64.tar.gz && tar xzf age.tgz && cp age/age age/age-keygen .
export PATH=/workspace/work/github/bin:$PATH
gitleaks version; git lfs version; age --version
```

### 步骤 2：确认推送通道（必须先过这一关）

```bash
apicall github user_me                     # 期望 login=pluto-da
# 拿用户已有的公开仓库探测写权限，不推任何东西：
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://github.com/pluto-da/kaoyan-zhengzhi-3d.git/info/refs?service=git-receive-pack"
```

- 返回 **200**：有写权限，继续下一步。
- 返回 **403**，并且正文是 `Permission to … denied to pluto-da`（2026-10-12 实测就是这个结果）：说明网关注入了身份，但这份授权没有写权限。按以下顺序处理：
  1. 用 `connector_accounts action=create connector=github`，理由写“需要写权限来创建私有仓库并推送 408 项目”，让用户重新授权 GitHub 连接。授权时需要包含：仓库内容读写（Contents: write）、创建仓库（Administration: write）、工作流文件（Workflows: write，因为要推 `.github/workflows/ci.yml`）。授权后重新执行上面的探测。
  2. 如果重新授权后仍然是 403，改走 **SSH 部署密钥**：用 `apt-get install -y openssh-client` 装上 ssh（装不了就用 paramiko 写一个 `GIT_SSH` 包装脚本）；`ssh-keygen -t ed25519 -f /workspace/work/github/k408_github_deploy -N "" -C k408-github-deploy`；仓库建好后（如果 repo_create 也没权限，就请用户在网页上自己建一个空的私有仓库 `k408-lab`，不要勾选 README），请用户在仓库 Settings → Deploy keys 里添加这把公钥并勾选 “Allow write access”（可以由 Hark 浏览器代办，需要用户登录 GitHub）。已实测 `github.com:22` 和 `ssh.github.com:443` 都能连上。远程地址改为 `git@github.com:pluto-da/k408-lab.git`。这把部署密钥只能访问这一个仓库，**和服务器私钥是两回事**，用完后私钥文件留在 `/workspace/work/github/` 下，权限设为 600，不入库。
  3. 用户也可以选择提供一个只授权给 `k408-lab` 的 fine-grained PAT（Contents、Administration、Workflows 读写）：通过 `request_secret` 存进保险库，不要让用户在聊天里贴出来。之后用 `git -c http.extraHeader="Authorization: Basic …"` 测试，因为网关可能会覆盖 Authorization 头，必须先测再用。
- **不推荐**用 `contents_put` 逐个文件上传作为主方案：每个文件生成一个提交，会丢掉全部 24 个提交的历史和作者时间；它需要的也是同样的写权限；文件以 base64 放在 JSON 里，大文件会失败。只有在只读通道下要补传一两个小文本文件时才用它。`git bundle` 作为 Release 附件可以保住历史，但上传附件同样需要写权限，所以只能作为补充备份（见步骤 8），不能替代推送。

### 步骤 3：创建私有仓库

```bash
apicall github --describe repo_create          # 再确认一次参数
apicall github repo_create name=k408-lab private=true \
  description="考研408动画实验室 · 私有全量仓库（代码+完整历史+部署+资料）"
apicall github repo_get owner=pluto-da repo=k408-lab   # 必须看到 "private": true；不是 true 立即停止并报告
```

如果同名仓库已经存在：先 `repo_get` 看它是不是空的、是不是私有的。不是空仓库就停下问用户，**绝对不要覆盖**。

### 步骤 4：做一份只读的 mirror 暂存副本，打标签

```bash
cd /workspace/work/github
git clone --mirror /workspace/fullstack-408 stage/k408-lab.git     # 只读取源仓库，不修改
cd stage/k408-lab.git
git rev-list --all --count          # 记下数字 N（预期 25 左右）
git rev-parse master                # 必须等于 GIT_OPTIONAL_LOCKS=0 git -C /workspace/fullstack-408 rev-parse master
# 打附注标签（只打在暂存副本上，不碰原仓库）：
for p in v1:7203144 v6:cb3a0e3 v7:52f5657 v8:dcc02e6 v9:e5e2fef v10:3330c2f v11:2118532 \
         v12:48fde11 v13:c19bcc9 v14:29c18e5 v15:71dd65f v16:514658c v17:19f8daf \
         v17a:7ae56fb v18:516667f v19:20912bb; do
  t=${p%%:*}; c=${p##*:}; git tag -a "$t" "$c" -m "$t（部署 BUILD_ID $t-$c）"; done
# v20：用 v20-finish 的提交号补上
# git tag -a v20 <v20提交> -m "v20"
git tag | wc -l
gitleaks git . --redact --no-banner          # 期望 no leaks found
```

### 步骤 5：推送 master 和标签

```bash
cd /workspace/work/github/stage/k408-lab.git
git remote add github https://github.com/pluto-da/k408-lab.git     # 或步骤 2 的 SSH 地址
git push github 'refs/heads/*:refs/heads/*'
git push github 'refs/tags/*:refs/tags/*'
git ls-remote github | wc -l        # 应等于 分支数 + 标签数（附注标签会多出 ^{} 行）
```

**不要用 `git push --mirror`**：以后再同步时，mirror 推送会把远程独有的 `archive` 分支删掉。

### 步骤 6：构建 archive 孤儿分支

```bash
cd /workspace/work/github
git clone stage/k408-lab.git archive-wt && cd archive-wt
git switch --orphan archive
git rm -rq --cached . 2>/dev/null; find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git lfs install --local
cat > .gitattributes <<'EOF'
*.mp4  filter=lfs diff=lfs merge=lfs -text
*.mov  filter=lfs diff=lfs merge=lfs -text
*.wav  filter=lfs diff=lfs merge=lfs -text
*.glb  filter=lfs diff=lfs merge=lfs -text
*.ply  filter=lfs diff=lfs merge=lfs -text
*.docx filter=lfs diff=lfs merge=lfs -text
*.age  filter=lfs diff=lfs merge=lfs -text
EOF
```

复制内容。没有 rsync，用 python 脚本 `collect.py` 按白名单复制，写好后先 `--dry-run` 打印清单和总大小：

- `prompts/`：`/workspace/work/*-prompt.md`、`*-prompt.docx`、`splat-research.md`、`promo/promo-prompt.*`、本文件和它的 docx；
- `reports/`：`work/audit.md`、`audit.txt`、`scan-before.txt`、`scan-after.txt`，所有 `REPORT.md`/`report.md`/`after-report.md`，以及 `work/v20/` 下的 `.md/.log/.sh/.cjs`（**不含** `fingerprints*.json`）；
- `scripts/`：`work/` 下所有 `.cjs .mjs .js .py .sh .ts .bak .tpl.ts`，**排除** `node_modules/`、`dist*/`、`live/assets/`、`pw-proxy-hook.cjs` 以外的代理凭据（这个 hook 只读 `HTTP_PROXY` 环境变量，不含明文，可以保留）；
- `deploy-history/`：`.deploy/*.sh`、`harden/*.sh`、`deleted.txt`；`rx.py`、`up.py` 复制后做脱敏：把 IP 换成 `os.environ["K408_HOST"]`，私钥路径换成 `os.environ.get("K408_SSH_KEY","~/.ssh/k408")`。**私钥、公钥、k408.tgz 都不复制**（公钥不敏感，但没有用处）；
- `promo/`：脚本、`narration.json`、`cover-*.png`、`promo-16x9.mp4`、`promo-9x16.mp4`、`clips/`；`promo2/` 有成品的话一并放进 `promo2/`；
- `legacy-vendor/`：`/workspace/deploy/vendor/*`；
- 一律排除：`cal.json`、`brief/`、`*.onnx`、`node_modules`、`dist-*`、`.trash`。

然后：

```bash
python3 /workspace/work/github/collect.py --dry-run   # 看清单，总量应在 100 MB 以内（不含 Release 部分）
python3 /workspace/work/github/collect.py
# 写 README.md、RESTORE.md、SECRETS.md（内容要求见下）
find . -type f -size +50M -not -path './.git/*'       # 期望没有输出
gitleaks dir . --redact --no-banner                   # 期望 no leaks found；有发现就逐条处理，不要用 allowlist 糊过去
grep -rIl "BEGIN OPENSSH PRIVATE KEY\|BEGIN RSA PRIVATE KEY" . --exclude-dir=.git   # 期望没有输出
git add -A && git commit -m "archive: 过程资料、Prompt、报告、部署历史、宣传视频（截至 v20）"
git remote add github https://github.com/pluto-da/k408-lab.git
git lfs push github archive        # 分批：超时就用 git lfs ls-files 列出对象，按 --object-id 分批推
git push github archive
```

三份文档的要求：
- **README.md**：仓库分支和标签说明；archive 的目录说明；Release 附件清单和解压方法（`cat x.partNN > x.tar.zst && zstd -d | tar x`）；“未包含的内容及去向”；ONNX 模型的来源和下载地址；指纹的确定性说明和 v21 加盐建议。
- **RESTORE.md**：新机器上从 clone 到上线的命令：`git clone`、`pnpm install --frozen-lockfile`、`cp .env.example .env` 后用 `openssl rand -hex 24/32` 生成密码、`docker compose up -d --build`、数据库从 `/var/backups/k408` 的 dump 恢复（`h6-restore-drill.sh` 演示了方法）、Caddy 自定义构建约需 20 分钟、国内服务器设置 `GOPROXY`/`NPM_REGISTRY`/`APT_MIRROR`、harden 脚本的执行顺序（h1 备份 → h2 SSH → h3 ufw → h4 fail2ban → h5 备份 cron → h6 演练）以及各自的回滚办法。
- **SECRETS.md**：列出 SSH 部署私钥、服务器 root 登录、POSTGRES_PASSWORD、JWT_SECRET、版权指纹、GitHub 部署密钥各自的用途、存放位置（服务器路径或 Hark 保险库）、如何轮换。**不写任何值**。

### 步骤 7：Release 附件（大体积过程素材）

```bash
cd /workspace/work/github && mkdir -p rel
# 每类打一个包，按 150 MB 分块，保证单块上传不超过 120 秒
tar -C /workspace/work -cf - shots shots-base shots-final shots-tmp shots-h shots-p v15 v16 v17 v18 v19 rwd toc todo-r17 redesign rs dis drag drag2 pc-shots ds1shots dsproc thumbs \
  --exclude=node_modules --exclude='dist-*' | zstd -T0 -10 | split -b 150M -d - rel/work-shots.tar.zst.part
# 同样方法打 work-media（promo/build shots tts music qa explore）、work-models（gltf pcb3d splat，排除 node_modules）、
# pc-model-build（/workspace/fullstack-408/tools/pc-model/build，只读打包）、work-dist-snapshots（可选）
( cd rel && sha256sum * > SHA256SUMS )
```

单条命令可能超过 120 秒时，把 tar 拆成几次分别执行（一次打一组目录）。不要打包 `work/v20` 里还在变化的内容，要等 v20 结束。

创建 Release 并上传：

```bash
apicall github release_create owner=pluto-da repo=k408-lab tag_name=archive-2026-10-12 \
  target_commitish=archive name="全量资料归档 2026-10-12" body="过程素材，解压说明见 archive 分支 README.md" draft=false
# 记下 release id；apicall 里没有上传附件的端点，直接用 curl（网关会注入凭据）：
curl -sS -X POST -H "Content-Type: application/octet-stream" --data-binary @rel/work-shots.tar.zst.part00 \
  "https://uploads.github.com/repos/pluto-da/k408-lab/releases/<RELEASE_ID>/assets?name=work-shots.tar.zst.part00"
```

一块一条命令。上传失败就重试一次，再失败就停下报告已上传的部分。全部传完后，用 `apicall github release_get` 核对附件数量和大小，和 `SHA256SUMS` 对照。

### 步骤 8：补充备份（可选，但推荐）

`git -C stage/k408-lab.git bundle create rel/k408-lab-full.bundle --all`，作为 Release 附件上传。将来就算账号出问题，单靠这一个文件也能 `git clone k408-lab-full.bundle` 还原出完整历史。

---

## 6. 敏感信息方案

**默认方案 A：密钥不入库（推荐）**
- 仓库里只有 `.env.example`（已存在，全是占位符）和 `archive/SECRETS.md`（说明每个密钥在哪里、怎么重新生成）。
- 服务器 SSH 私钥继续只放在 `/workspace/.deploy/`（权限 600）；生产 `.env` 继续只放在服务器上。
- 好处：GitHub 账号或授权哪怕出问题，也不会连带丢掉服务器和数据库。坏处：工作区和服务器同时丢失时，要重新生成密钥（`h2` 已经改成只允许密钥登录，到时需要通过云厂商控制台重新注入公钥）。

**可选方案 B：age 加密后入库（用户明确选择才做）**
```bash
cd /workspace/work/github && umask 077 && mkdir -p sec
cp /workspace/.deploy/hark_408 /workspace/.deploy/id_ed25519 /workspace/work/v20/fingerprints*.json sec/
# 生产 .env 用 paramiko 通过 SFTP 只读拉取 /opt/k408/.env → sec/prod.env（不在输出里打印内容）
# age 的口令模式（-p）需要交互终端，这里不用；改用 age-keygen 生成一对身份密钥：
age-keygen -o k408-age-identity.txt 2> k408-age-recipient.txt   # 第二个文件里是 age1… 公钥
# 先用 save_known_secret 把 k408-age-identity.txt 的内容存进用户的 Hark 保险库
# （标签：k408 GitHub 加密包解密身份），确认保存成功后再继续
mkdir -p archive-wt/secrets
tar -C sec -cf - . | age -r "$(grep -o 'age1[0-9a-z]*' k408-age-recipient.txt)" -o archive-wt/secrets/k408-secrets.tar.age
shred -u sec/* k408-age-identity.txt; rmdir sec
```
- 只入库 `.age` 密文，身份私钥（或口令）只存在 Hark 保险库里，**绝不写进仓库、聊天或日志**。
- 解密：`age -d -i identity.txt k408-secrets.tar.age | tar x`，写进 SECRETS.md。
- 要提醒用户：加密入库之后，任何人拿到“仓库 + 保险库”两样就等于拿到服务器。这比方案 A 多一个风险面。

**方案 C（不推荐，只在用户坚持时）**：git-crypt 或 sops。git-crypt 需要编译安装，适合长期多人协作；sops 适合结构化的 .env。对单人项目来说，age 打一个包就够了。

**无论哪种方案都必须做到**：生产数据库 dump 永不入库；推送前 gitleaks 扫描为 0；任何输出和报告里都不打印密钥内容；SSH 私钥一旦误推（哪怕推的是私有仓库），立即在服务器 `authorized_keys` 里删掉对应公钥、换新密钥，然后再清理历史。

---

## 7. 大文件方案

| 类别 | 体积 | 去向 |
|---|---|---|
| 主仓库历史（含 glb/sog 模型） | 原始 54.1 MiB，压缩后预计 40 MB 以内 | 普通 git，直接推 |
| 宣传成片、封面、docx | 约 35 MB | archive 分支，走 LFS |
| 过程截图、对比图 | 约 330 MB（PNG）加约 65 MB（JPG） | Release 附件 |
| 音频（tts/music/wav） | 约 130 MB | Release 附件 |
| 实验模型（work/gltf、pcb3d、splat 等） | 约 126 MB（GLB） | Release 附件 |
| tools/pc-model/build | 261 MB | Release 附件（也可以用 `tools/pc-model/run.sh` 重新生成） |
| dist 前后副本 | 约 102 MiB | Release 附件（可选，可以从对应标签重新构建） |
| ONNX 语音模型 | 60.3 MB | 不入库，README 写明来源 |
| 教材 PDF | 815 MB，每本都超过 100 MB | 默认不上传；用户选了的话放 Release 附件（每本小于 2 GB，不用分块，但单条上传可能超过 120 秒，需要先按 150 MB 分块） |

LFS 用量预计不到 50 MB，远低于 10 GiB 的免费存储额度；Release 不占额度。

---

## 8. 推送方式（实测结论）

2026-10-12 实测：
- `apicall github user_me` → 账号 `pluto-da`，已有 1 个公开仓库 `kaoyan-zhengzhi-3d`，没有私有仓库。
- 访问 `api.github.com` 时网关会自动注入凭据：响应头 `X-OAuth-Client-Id: Iv23…`（GitHub App 的用户令牌），`X-OAuth-Scopes` 为空，`/user/installations` 返回 0 个安装，限流 15000 次/小时。
- `git ls-remote https://github.com/pluto-da/kaoyan-zhengzhi-3d` 成功；对不存在的仓库返回 “Repository not found”。
- `info/refs?service=git-receive-pack`（推送前的握手）对用户自己的仓库返回 **403：“Permission to pluto-da/kaoyan-zhengzhi-3d.git denied to pluto-da.”**。这说明网关在 git HTTPS 上也注入了身份，但这份授权**没有写权限**；用 REST 查同一个仓库，用户本人的权限是 admin/push，可见缺的是应用授权，不是账号权限。
- 推断：当前的 GitHub 连接很可能也无法建私有仓库、无法上传 Release 附件（都需要写权限）。`repo_create` 按要求没有实测。
- SSH：`github.com:22`、`ssh.github.com:443` 都能连通（收到了 SSH 握手）；环境里没有 ssh 客户端，需要 apt 安装或者用 paramiko。

所以执行顺序是：**先解决授权（步骤 2），再建仓库，再推送**。推荐通道依次是：重新授权后的 HTTPS（最简单，LFS 和 Release 都能走）→ SSH 部署密钥（只管 git 推送；LFS 也能走 SSH；Release 上传仍然需要 API 写权限，不行就请用户在网页上手动上传，或者把附件改成 LFS 放进 archive 分支，LFS 额度足够）→ fine-grained PAT。

---

## 9. 仓库安全设置

在 GitHub Free 个人账号下，私有仓库能用和不能用的功能：
- **私有可见性**：建完立刻用 `repo_get` 确认 `private: true`。以后不要改成公开；archive 分支和 Release 里有大量内部资料。
- **Dependabot alerts**：免费，可以开（`PUT /repos/pluto-da/k408-lab/vulnerability-alerts`；apicall 里没有这个端点，用 curl 调，网关会注入凭据；没有权限就请用户在 Settings → Code security 里打开）。Dependabot security updates 会自动开 PR，可以先不开，以免干扰版本节奏。
- **Secret scanning 和 push protection**：个人账号的私有仓库**用不了**（需要付费的 GitHub Secret Protection，而且只面向组织仓库；个人的 “push protection for users” 只保护推往公开仓库的提交）。来源：https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning 。替代办法：每次推送前在暂存副本里跑 `gitleaks git` 和 `gitleaks dir`，并把这一步写进同步脚本。
- **分支保护**：私有仓库需要 GitHub Pro 才能用（https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule ）。Free 计划下不设置；用户本来就是唯一写入者，同步脚本只做快进推送，绝不强推，也能达到同样的效果。
- **Actions**：保留 CI；在 Settings → Actions 把 `GITHUB_TOKEN` 默认权限设为只读；留意每月 2000 分钟的私有仓库额度。
- **账号层面**：建议用户为 GitHub 账号开启两步验证；推送完成后，在 GitHub Settings → Applications 里检查 Hark 应用的权限，用户愿意的话可以把写权限只限定在 `k408-lab` 这一个仓库。
- **不添加任何协作者**；没有用户同意不开 Pages、不开 Wiki。

---

## 10. 验收清单

在一个全新目录里验证，不能复用暂存副本：

1. `apicall github repo_get owner=pluto-da repo=k408-lab` → `private: true`。
2. `git clone https://github.com/pluto-da/k408-lab.git /tmp/verify && cd /tmp/verify`：
   - `git rev-parse origin/master` 等于本地 `/workspace/fullstack-408` 的 `master`；
   - `git rev-list origin/master --count` 等于本地的提交数（采集时 24，v20 之后预计 25 或更多）；
   - `git tag | wc -l` 等于打的标签数，`git show v19 --stat` 指向 20912bb；
   - `git branch -r` 能看到 `origin/master` 和 `origin/archive`。
3. 安装、构建、测试（每步单独执行，控制在 120 秒内）：
   - `pnpm install --frozen-lockfile --prefer-offline --store-dir /workspace/.pnpm-store`
   - `pnpm typecheck`、`pnpm lint`、`pnpm test`（API 测试需要 Postgres：设置 `TEST_DATABASE_URL`，或者用仓库自带的 embedded-postgres 方式，以 `apps/api/test/global-setup.ts` 为准）、`pnpm build`；
   - `cp .env.example .env && docker compose config -q`（没有 docker 就跳过，并在报告里注明）。
   - 任何一项失败，先和本地原仓库在同一提交上的结果对比：本地也失败，属于原有问题，只记录；只有 clone 下来的才失败，说明打包漏了东西，必须修正。
4. 安全：`gitleaks git /tmp/verify --log-opts="--all" --redact` 和 `gitleaks dir /tmp/verify` 都是 0；`git log --all -p | grep -c "BEGIN OPENSSH PRIVATE KEY"` 为 0；服务器 IP 在 master 历史里出现 0 次（archive 里按 12 节第 1 项的选择处理）。
5. archive：`git switch archive && git lfs pull && git lfs fsck` 通过；`sha256sum -c MANIFEST.sha256` 通过；README、RESTORE、SECRETS 三份文档齐全。
6. Release：附件数量和总大小与 `SHA256SUMS` 一致；随机抽一个包下载，`cat part* | zstd -d | tar t | head` 能列出文件。
7. 如果选了方案 B：用保险库里的身份文件解密 `k408-secrets.tar.age`，执行 `tar t` 能列出文件（不显示内容），验证完立即删除临时解密文件。
8. CI：查看首次 workflow 运行的结果，写进报告。
9. 原仓库没有被改动：`GIT_OPTIONAL_LOCKS=0 git -C /workspace/fullstack-408 remote -v` 仍然为空，分支和配置都和执行前一样。

---

## 11. 回滚与后续同步

**回滚**
- 推错了但没有涉及密钥：在暂存副本里修正，然后对 archive 分支 `git push --force-with-lease`。master 永远不强推。
- 误推了密钥：先**轮换密钥**（服务器换 SSH 密钥、重置 POSTGRES_PASSWORD 和 JWT_SECRET、重新部署），再用 `git filter-repo` 清理历史并强推，最后联系 GitHub Support 清除缓存的视图。只删仓库是不够的，密钥必须当作已经泄露处理。
- 想整个推倒重来：删除仓库需要 `delete_repo` 权限，Hark 当前没有，请用户在 Settings → Danger zone 里自己删。**未经用户明确同意，不要删除仓库**。
- 暂存目录 `/workspace/work/github/stage`、`archive-wt` 保留，作为下次同步的基础。

**后续同步（每出一个新版本）**
推荐写一个 `/workspace/work/github/sync.sh`，在每个版本任务完成并提交之后执行：
```bash
cd /workspace/work/github/stage/k408-lab.git
git fetch /workspace/fullstack-408 '+refs/heads/*:refs/heads/*'     # 从本地仓库取新提交（只读）
git tag -a vNN <新提交> -m "vNN"
gitleaks git . --redact --no-banner || exit 1
git push github 'refs/heads/master:refs/heads/master' --follow-tags  # 只快进，失败就停下
# 新的 Prompt、报告、截图：更新 archive-wt，提交后 git push github archive；大素材另开一个新的 Release
```
另一种更简单的做法：等所有并发任务都结束后，经用户同意，在原仓库里 `git remote add origin git@github.com:pluto-da/k408-lab.git`，以后每个版本 Prompt 的最后一步都加上 `git push origin master --follow-tags`。这会修改原仓库的配置，所以必须等没有其他任务在用这个仓库时才做。
如果用户希望定期自动同步，可以提议建一个定时任务（比如每天 23:00 执行 sync.sh）。**本次不创建**，要先问用户。

---

## 12. 需用户决定的事项（最多 3 项，均有默认值）

1. **密钥怎么处理？**
   默认：**不入库**，只入库 `.env.example` 和一份“密钥在哪、怎么重新生成”的说明。
   可选：用 age 加密打包后入库（含两把 SSH 私钥、从服务器拉取的生产 .env、防扒指纹），解密钥匙只存在 Hark 保险库里。
   （服务器 IP 不算密钥：默认保留在私有仓库的过程文档里，脚本里的 IP 一律改为读环境变量；用户如果希望连文档里的 IP 也抹掉，就一并替换为 `<SERVER_IP>`。）
2. **4 本王道教材 PDF（815 MB）和大体积过程素材要不要上传？**
   默认：**教材 PDF 不上传**（有版权，每本都超过 100 MB，用户本地有原件）；过程截图、音频、实验模型、3D 构建产物**全部上传**，作为 Release 附件。
   可选：教材也作为 Release 附件上传；或者反过来，过程素材也不要，只保留代码、文档和成片。
3. **和 v20 的时间怎么安排？**
   默认：**等 v20 提交并部署完成后再推**，一次推全，v20 的审计报告也一起归档。
   可选：现在先推已提交的 v1 到 v19 历史和已完成的资料，等 v20 完成后再增量同步（mirror 只读取已提交的对象，不会干扰 v20 任务）。

另外有一个**不是选项但必须由用户完成的前提**：当前的 GitHub 连接没有写权限（推送握手返回 403）。需要用户重新授权一次 GitHub 连接，或者在仓库里添加一把部署密钥。没有这一步，任何推送方式都走不通。

---

## 13. 执行代理的硬性约束（汇总）

- 不修改 `/workspace/fullstack-408` 的任何文件、分支、标签、远程或 git 配置（11 节里经用户同意的 `remote add` 除外，而且必须在没有其他任务时做）。
- 不明文推送任何私钥、生产密码、JWT 密钥、数据库备份；推送前 gitleaks 必须为 0。
- 不在任何输出、报告、提交说明里打印密钥内容。
- 仓库必须从创建那一刻起就是私有的；`repo_get` 确认不是 private 时立即停止。
- 不强推 master；不使用 `git push --mirror`。
- 每条命令不超过 120 秒；同一步失败两次就停止并报告。
- 不删除仓库，不添加协作者，不创建定时任务，除非用户明确同意。
- 最终报告要包含：仓库地址、提交数和标签数核对、archive 文件数和体积、Release 附件清单和 SHA256、验收清单逐项结果、CI 结果、未包含内容的清单和去向。
