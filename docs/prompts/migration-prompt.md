# 账号迁移全量打包 · 执行 Prompt（考研408动画实验室 / 王达）

> 版本：2026-10-12 17:55（北京时间）。本文件由只读盘点后写成，盘点期间没有打包、删除或修改任何文件。
> 执行者：下一步接手的 Hark 子任务（下文称“执行者”）。请把本文件当作完整的任务书，从头读到尾再动手。

---

## 0. 你的角色、边界与硬性约束

你要做的，是帮用户（王达，称呼“大哥”）在**放弃当前 Hark 账号之前**，把这个账号里一切有价值、换号后会丢的东西，按优先级打成若干个可校验、可恢复的包，交到用户手里，并写好在新账号里接着干的指南。

硬性约束，任何一条都不能破：

1. **单条命令不超过 120 秒。** 大文件一律分步做：先 `tar`/`split`，再算哈希，再交付；不要把“打包＋压缩＋哈希”塞进一条命令。同一个步骤连续失败两次，就停下来，把卡在哪里、已经产出了什么写进报告，不要第三次硬试。
2. **口令不在聊天里出现。** 不得把加密口令写进任何聊天消息、任何交付给用户的文件名或文件内容里。口令的落点见第 4.2 节。
3. **Hark 记忆不能导出。** 不得复制、打包、展示或描述 Hark 的记忆文件及其组织方式。记忆部分只能由你**重新写一份全新的中文《交接说明》**（第 6.1 节给出写法），用户在新账号里把它粘贴给新的 Hark 即可。
4. **系统内置技能的内容不得外泄。** 用户自建的技能可以导出，但本次盘点结果是：用户自建技能为 0 个，所以这一项只需要在清单里写“无”。
5. **不删除任何源文件。** 打包只读不写源目录；所有产物只写到 `/workspace/work/migration/` 下。`.trash`、`.pnpm-store` 等垃圾目录也不要去清理，留给用户以后决定。
6. **不碰服务器上的业务配置。** 你对服务器 `154.8.183.93` 只做“读”和“拉取备份”：读 `.env`、拉数据库备份、查看 SSH 配置状态。唯一允许的写操作是第 7 节里的“追加新账号公钥”，而且必须用户同意后才做。
7. **单个交付文件 ≤ 450 MB。** 超过就分卷，按 P0 → P1 → P2 → P3 的顺序交付，前一层用户确认收到后再发下一层。不要先去实测几百 MB 的文件能不能通过聊天发出去，直接按 450 MB 上限分卷。

---

## 1. 需求深度剖析

### 1.1 用户原话与真实意图

用户问的是：“是全部吗？因为我要换账号了。”

这句话背后有三层意思：

- **表层**：他看到 github-export 子任务的打包方案里有“默认排除项”（SSH 私钥、`.env`、四本教材 PDF、日历数据、指纹清单、60 MB 语音模型、`node_modules` 与构建产物），想确认是不是全都带走了。
- **中层**：他要换一个新的 Hark 账号，当前账号的工作空间 `/workspace` 之后很可能再也打不开。对他来说，“没带走”就等于“永久丢失”。github-export 的排除逻辑是“哪些东西不该进 GitHub 仓库”，这个逻辑在换号场景下不成立——不进仓库的东西，也得有个地方安全地放。
- **深层**：他真正怕的是“换号之后网站没人管、服务器进不去、做了一周的成果断档”。所以“全部”的真正含义不是“每一个字节”，而是**“换号后我能无缝接着干，服务器不失联，成果一样不少，敏感东西不外泄”**。

### 1.2 “全部”应当拆成四类

| 类别 | 含义 | 处理原则 |
|---|---|---|
| 救命的 | 丢了就进不去服务器、恢复不了线上数据 | 最先交付，必须加密，必须验证能用 |
| 吃饭的 | 代码与完整提交历史、部署脚本 | 推到 GitHub 私有仓库 ＋ 本地 bundle 双保险 |
| 积累的 | 各版 Prompt、报告、截图、宣传片、其他小项目、Hark 页面 | 打成资料包，可分卷 |
| 占地方但可再生或可另找的 | 教材 PDF、语音模型、三维模型构建产物、依赖目录 | 按用户决定，分卷放最后；可再生的只带“再生方法” |

此外还有一类**不在工作空间里、但换号一样会丢**的东西：Hark 首页面板、定时任务、自建技能、密钥保险箱里的令牌、GitHub 与 Google 的连接授权、Hark 记忆。它们不能“打包”，只能“写成说明，到新账号重建”。

### 1.3 换号后会丢什么、不会丢什么

**会丢（必须处理）：**

- `/workspace` 里的一切文件（代码工作区、未提交的 v20 改动、`.deploy` 下的两把私钥和部署脚本、`work/` 下所有 Prompt 与产物、用户上传的文件）。
- Hark 记忆（只能靠《交接说明》重建）。
- 首页上的 2 个面板及其每日刷新。
- 密钥保险箱里的 1 条“GitHub 个人访问令牌”。
- GitHub、Google 两个连接器的授权。
- 当前账号里用 Hark 建的 5 个页面（Page）。

**不会丢（但要写进指南）：**

- 服务器本身、服务器上的代码、生产 `.env`、数据库与每日备份——它们在腾讯云上，属于用户的腾讯云账号。
- 用户的 GitHub 账号与仓库（`pluto-da/...`）、Gmail 与 Google 日历、Google Drive。
- 腾讯云控制台的登录能力：控制台里的 OrcaTerm“免密登录”走的是腾讯云自动化助手（TAT），不依赖 SSH 密码或私钥（来源：https://cloud.tencent.com/document/product/1665/84581 ，https://cloud.tencent.com/document/product/1207/44642 ）。这是私钥丢失时的最后一道兜底，但前提是实例里的自动化助手在运行，必须让用户亲自确认一次。

### 1.4 必须带走、不该带走、必须加密

- **必须带走**：服务器私钥 `hark_408`；第二把私钥 `id_ed25519`（注释 `hark-deploy-408b`，用途需在执行时确认，见 R2）；生产 `.env` 的副本；最新数据库备份；完整 git 历史；未提交的 v20 改动；所有 Prompt、报告、部署与加固脚本；宣传片成片与 promo2；Hark 页面的 `index.html`；两个面板的重建说明；《交接说明》。
- **不该带走**：`node_modules`（共约 425 MB 仅主仓库一处，另有 `work/gltf`、`work/pw` 等多处）、`.pnpm-store`（386 MB）、`.trash`（1.4 GB，系统回收站，里面是重复的二进制）、`.hark`（系统目录）、各种 `dist`/`build` 中间产物、日历与邮件的原始数据副本（`work/cal.json`、`work/brief/` 整个目录——这些是从用户 Google 账号读出来的原始数据副本，数据本身还在用户 Google 账号里，不需要也不应该另存）。
- **必须加密**：P0 救命包全部内容（私钥、`.env`、数据库备份、指纹清单）。数据库备份里有网站注册用户的邮箱和密码哈希，属于第三方个人信息，泄露的后果比私钥还难收拾。

---

## 2. 完整资产清单与体积（2026-10-12 17:50 只读盘点，真实数字）

> 体积用 `du -sh`（二进制单位，M = MiB）测得；个别数字因其他子任务仍在写文件，执行时会略有增长，以执行时重新测量为准。

### 2.1 工作空间总览

| 路径 | 体积 | 说明 | 归属层 |
|---|---|---|---|
| `/workspace/.deploy/` | 81 K | `hark_408`（服务器 root 私钥，注释 hark-deploy-408）、`id_ed25519`（注释 hark-deploy-408b）、`k408.tgz`（66 KB，v20 上传源码包）、`d.sh`～`d14.sh`、`d14-rollback.sh`、`e.sh`、`up.py`、`rx.py`、`harden/h1～h6` | 私钥进 P0，脚本进 P2 |
| `/workspace/fullstack-408/` | 766 M（不含 node_modules 为 351 M） | 主仓库（pnpm monorepo） | P1 / P3 |
| 　其中 `.git` | 38 M | 24 次提交，只有 `master` 一个分支，HEAD = `20912bb v19: data ride UI redesign`；对象全部是散对象（993 个，36.37 MiB，没有打包） | P1 |
| 　其中未提交改动 | — | `git status` 共 109 行，`106 files changed, +1537 −352`，这就是正在部署的 v20 | P1（关键！） |
| 　其中 `tools/pc-model/build` | 261 M | 整机模型构建产物（被 .gitignore 忽略，含 6 个约 16 MB 的 `*_open.ply`） | P3（可选） |
| 　其中 `apps/web` | 65 M | 前端源码与静态资源 | P1 |
| 　其中 `node_modules` | 425 M | 依赖 | 不带 |
| `/workspace/files/uploads/` | 819 M | 4 本教材 PDF 共 854,756,012 字节（约 815 MiB：数据结构 212 MB、组成原理 209 MB、计算机网络 197 MB、操作系统 236 MB）＋ 其他 8 个上传文件共约 3.1 MB（4 张 jpg、1 张 webp 截图、微信图片 1 张、`功能清单初版.xlsx` 与 `功能清单初版-2.xlsx`） | PDF 进 P3；其他上传文件进 P2 |
| `/workspace/uploads` | 0 | 指向 `files/uploads` 的符号链接，不重复打包 | — |
| `/workspace/work/` | 1.1 G | 各版 Prompt、报告、截图、宣传片、v15～v20 输出等 | P2 / P3 |
| 　`work/promo` | 363 M | 宣传片：`build` 160 M（中间音视频，含 4 个 15 MB 的 wav）、`voices` 61 M（`zh_CN-huayan-medium.onnx` 语音模型）、`music` 9.2 M、成片 `promo-16x9.mp4` 25 M 与 `promo-9x16.mp4`、封面、脚本、`REPORT.md`、`promo-prompt.md/.docx` | 成片＋脚本＋报告进 P2；build 与语音模型进 P3 |
| 　`work/promo2` | 86 K | `promo2-prompt.md/.docx`、`vt-probe.cjs` | P2 |
| 　`work/v20` | 259 M | v20 审计输出：`site1` 57 M、`tb2～tb6` 各 26 M、大量截图与日志、`fingerprints.json`、`fingerprints-test.json` | 指纹进 P0；报告与少量代表截图进 P2；其余截图进 P3（可选） |
| 　`work/gltf` | 102 M | 三维模型素材（含 node_modules） | P3（去掉 node_modules） |
| 　`work/rwd` 84 M、`work/toc` 57 M、`work/v19` 37 M、`work/shots` 36 M、`work/pcb3d` 17 M、`work/splat` 23 M、`work/v18` 15 M、`work/pw` 14 M、`work/todo-r17` 12 M 等 | — | 各轮截图、调试与过程素材 | 报告与 Prompt 进 P2，截图进 P3（可选） |
| 　`work/github` | 约 10～47 M（仍在增长） | github-export 子任务的工作区：`github-prompt.md/.docx`、`collect_export.py`、`export-stage/` | 复用，不重复打包 |
| 　顶层 Prompt | — | `work/` 顶层 `*-prompt.md` 共 15 个，多数配有 `.docx` | P2 |
| `/workspace/built/` | 11 M | 5 个 Hark 页面＋2 个面板目录 | P2 |
| `/workspace/arcade/` 与根目录 8 张 png | 580 K ＋ 约 13.2 MB | 爆款小游戏的封面与主视觉 | P2 |
| `/workspace/deploy/vendor` | 713 K | 部署用第三方文件 | P2 |
| `.pnpm-store` 386 M、`.trash` 1.4 G、`.hark` 3 M | — | 依赖缓存、系统回收站、系统目录 | 不带 |
| `/workspace/projects/` | 不存在 | 任务描述里提到的这个目录实际上没有；“其他项目”散落在 `arcade/`、根目录 png 和 `built/sites/` 里 | — |

### 2.2 不在文件系统里的资产

| 资产 | 盘点结果 | 处理 |
|---|---|---|
| 用户自建技能 | 0 个（列表里全部是系统技能） | 清单写“无” |
| 用户定时任务 | 0 个（列表里只有系统自动建的面板刷新与回访任务，不属于用户，不迁移、不在面向用户的文字里提） | 清单写“无” |
| 首页面板 | 2 个，均为每日刷新、状态正常：①“考研政治知识链”（每天按 马原→毛中特→史纲→思修法基 轮换，取一个高频考点＋3～5 个关联考点＋口诀，数据源 zhenti.zalize.com）；②“考研政治时政”（往年 15/16/32/33/38 题时政规律＋当前热点，数据源 news.cn、koolearn.com） | 导出两份“面板重建说明”，放进 P2 |
| Hark 页面 | 5 个：`408 知识立体图`（5.1 M）、`考研408动画实验室 实拍电路板`（2.9 M）、`爆款小游戏`（971 K）、`小游戏大厅`（368 K）、`Mini Game Arcade`（329 K） | 各自的 `index.html` 进 P2 |
| Hark 其他项目 | 0 个 | 无 |
| 密钥保险箱 | 1 条：GitHub 个人访问令牌 | 不导出令牌本身；指南里写“新账号重新保存，旧令牌迁移后到 GitHub 吊销” |
| 连接器 | GitHub（已连）、Google（已连，wda151050@gmail.com） | 指南里写“新账号重新连接” |
| GitHub 仓库 | 计划中的私有仓库 `pluto-da/k408-lab`；之前尝试推送的是 `pluto-da/kaoyan-zhengzhi-3d`（见 github-prompt.md 第 200 行附近）。截至盘点时 github-export 尚未产出 `/workspace/work/github/export/` 目录，是否已推送成功未知 | 执行时以 github-export 的报告为准 |
| 服务器（腾讯云轻量 北京 2核2G，Ubuntu 24.04） | 部署目录 `/opt/k408`，生产 `.env` 在 `/opt/k408/.env`；部署脚本还会在 `/root/` 下留 `k408.env.v19-<时间戳>` 与 `k408-src-v19-<时间戳>.tgz`；h5 若已执行，备份在 `/var/backups/k408/k408-*.dump`（保留 7 天，每天 03:30） | P0 从服务器拉取 |

### 2.3 预估各层体积

- P0：小于 5 MB（两把私钥约 1 KB，`.env` 几 KB，数据库备份目前用户极少，预计在 1 MB 以内，指纹清单很小）。
- P1：约 40～60 MB（git bundle ＋ v20 未提交改动的补丁与完整工作树快照，不含 node_modules 和构建产物）。
- P2：约 150～250 MB（取决于截图保留多少；宣传片成片 2 个、页面 5 个、Prompt 与报告约百余个文件）。
- P3：约 1.0～1.4 GB（教材 PDF 815 MiB ＋ 语音模型 61 M ＋ 宣传片中间件 160 M ＋ 模型构建产物 261 M ＋ 过程截图），按 450 MB 分卷约 3～4 卷。

---

## 3. 风险清单

| 编号 | 风险 | 等级 | 说明与对策 |
|---|---|---|---|
| R1 | **私钥丢失导致服务器失联** | 最高 | v20-deploy 的 h2 会写入 `/etc/ssh/sshd_config.d/00-k408-hardening.conf`，关闭密码登录、root 只允许密钥。之后能登录服务器的只有 `/workspace/.deploy/hark_408` 这把私钥和腾讯云控制台。换号后工作空间打不开，私钥就跟着没了。对策三层：①“公钥握手”——让新账号自己生成新密钥，把公钥加到服务器（第 7.2 节，首选，私钥根本不用搬家）；②P0 加密备份旧私钥；③请用户亲自在腾讯云控制台点一次“免密登录”，确认兜底可用。注意：腾讯云文档说“在线重置密码”会把 `PasswordAuthentication` 改回 yes，但我们的加固写在 `sshd_config.d/00-...` 里，按 sshd“先读到的值生效”的规则，这个文件很可能优先于主配置，所以**不要指望重置密码能救急**（这是推断，未实测），应该靠 OrcaTerm 免密登录删掉这个文件或追加公钥。 |
| R2 | 第二把私钥用途不明 | 高 | `.deploy/id_ed25519`（注释 hark-deploy-408b）在盘点中未找到明确用途。执行时用 `rx.py` 在服务器上查 `/root/.ssh/authorized_keys` 是否含其公钥；再看它是否被加到 GitHub 部署密钥。不论查到什么，都一并放进 P0，并在清单里写明用途或“用途未确认”。 |
| R3 | 密钥或口令泄露 | 高 | 私钥、`.env`、数据库备份只进加密包；口令不经过聊天；交付后提醒用户把加密包放在自己的设备或网盘，口令放进密码管理器。迁移完成后建议轮换：服务器上删掉旧公钥、GitHub 吊销旧令牌、生产 `JWT_SECRET` 可以择机更换（会让所有在线用户重新登录）。 |
| R4 | v20 未提交改动丢失 | 高 | 当前 HEAD 还是 v19，v20 的 106 个文件改动没有提交。如果只打 HEAD 的 bundle，v20 就丢了。对策：P1 同时包含 `git diff --binary HEAD` 补丁、`git status` 清单、不含依赖的完整工作树快照。不要替用户或 v20-deploy 去 `git commit`，那是 v20-deploy 的事；如果 v20-deploy 已经提交，就以提交后的 HEAD 重新打 bundle。 |
| R5 | 数据库备份不新或不存在 | 中 | h5 可能还没跑。执行时先查 `/var/backups/k408/` 有没有当天的文件；没有就用 h5 写好的脚本 `/usr/local/sbin/k408-db-backup.sh` 手动跑一次；脚本也不存在就直接用 `docker compose exec -T postgres pg_dump -Fc` 导出（只读操作）。 |
| R6 | 教材 PDF 版权 | 中 | 四本教材 PDF 只能作为用户个人复习备份：只交给用户本人，不推送到 GitHub（公开或私有都不推），不上传到任何公开位置，不放进对外分享的链接。清单里写明“仅供个人备份”。 |
| R7 | 个人日历与邮件数据 | 中 | `work/cal.json`、`work/brief/` 下是从用户 Google 账号读出来的原始日历与邮件数据副本，换号后数据本身仍在 Google，打包它只会多一份泄露面。默认不打包，也不要删除（删除不在本任务范围）。 |
| R8 | 指纹清单泄露 | 低 | `work/v20/fingerprints*.json` 是防扒版权指纹。github-prompt 已指出指纹由源码确定性生成，单独泄露意义有限，但仍放进 P0 加密包，并在交接说明里记下“v21 建议给指纹加服务器侧盐 `K408_FP_SALT`”。 |
| R9 | 聊天交付大文件失败 | 中 | 每个文件不超过 450 MB；每交付一个就让用户确认能下载、哈希一致；失败就把该卷再切小（例如 200 MB）重发，同一卷失败两次就停下，改走用户 Google Drive（需用户同意）。 |

---

## 4. 推荐方案：分层交付

总原则：**先救命，再吃饭，再积累，最后占地方的。** 每一层单独成包、单独校验、单独交付，前一层用户确认后才发下一层。所有产物写到：

```
/workspace/work/migration/
  out/P0/  out/P1/  out/P2/  out/P3/
  stage/          ← 临时整理区，交付后可留着
  SHA256SUMS.txt  ← 所有交付文件的哈希
  MANIFEST.md     ← 每个包装了什么、怎么恢复
  交接说明.md      ← 给新账号 Hark 的中文交接文本
  面板重建说明.md
```

### 4.1 P0 救命包（最先交付，必须加密）

**内容：**

1. `keys/hark_408` 与 `keys/hark_408.pub`（服务器 root 私钥）。
2. `keys/id_ed25519` 与 `keys/id_ed25519.pub`（第二把私钥，附用途说明或“用途未确认”）。
3. `server/prod.env`：从服务器 `/opt/k408/.env` 用 SFTP 拉下来（只读）。
4. `server/env-backups/`：`/root/k408.env.v19-*` 里最新的一份。
5. `server/db/k408-<时间>.dump`：最新的数据库备份（见 R5 的三级取法），附 `pg_restore` 恢复命令。
6. `fingerprints/fingerprints.json`、`fingerprints-test.json`。
7. `ACCESS.md`：服务器访问说明——IP `154.8.183.93`、用户 root、私钥登录命令（`ssh -i hark_408 root@154.8.183.93`）、Windows 用户可用 Termius/Xshell 导入私钥、腾讯云控制台 OrcaTerm 免密登录兜底步骤、h2 回滚命令（删除 `/etc/ssh/sshd_config.d/00-k408-hardening.conf` 后 `systemctl reload ssh`）、部署目录 `/opt/k408`、备份目录 `/var/backups/k408`、ICP 备案未完成前只用 IP 自测不对外推广。**ACCESS.md 里不写任何密码、令牌或 `.env` 的值。**

**加密方式（默认）：7z AES-256，并加密文件名（`-mhe=on`）。**

- 工具：沙箱里现在没有 `7z`，也没有 `age`。按顺序尝试：`apt-get install -y p7zip-full`；不行就 `pip install py7zr`（支持写入 AES-256 加密的 7z，含文件头加密）；两种都失败两次，就退到 `openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt` 加密一个 tar，并在 ACCESS 说明外另写一份“如何解密”的纯文本（不含口令）。7z 是首选，因为用户在 Windows（7-Zip）、安卓（ZArchiver）、苹果（Keka）上都能直接输口令解压。
- 文件名：`k408-P0-rescue-20261012.7z`（不得含口令或提示）。

### 4.2 口令怎么产生、放在哪里

先说清楚一个事实：Hark 的安全表单（request_secret）保存的密钥只会被注入到指定网站的请求里，**沙箱和执行者都读不到它的值**，所以“让用户在安全表单里设口令、再由沙箱拿来加密”这条路走不通，不要尝试。

**默认做法：**

1. 在沙箱里用 `python3 -c "import secrets; ..."` 生成一个高强度随机口令（例如 6 组、每组 5 个字符，排除易混字符 0/O/1/l，约 120 比特熵），只放在本次命令的内存与一个权限 600 的临时文件里。
2. 用这个口令加密 P0。
3. 把口令交给用户本人另行保管，口令与加密包走两条不同的路。（归档副本说明：口令的存放位置不在仓库中记录，已删去本句。）
4. 确认口令已交给用户后，立即删除沙箱里的临时口令文件（`shred -u`），报告里不写口令本身。
5. 提醒用户：把口令抄进密码管理器（或写在纸上锁好），删掉其他任何临时存放处。

**备选（用户选了再做）：不加密，直接交付私钥文件。**

- 好处：最简单，用户下载后立刻能在 Termius 里用；不存在“忘了口令包就打不开”的风险。
- 坏处：私钥以明文躺在用户的下载目录、聊天记录和可能的网盘同步里，谁拿到谁就能以 root 进服务器；`.env` 和数据库备份更不能这样给。
- 结论：只有私钥两份文件可以按用户要求明文交付，`.env`、数据库备份和指纹清单无论如何都要加密。即使明文交付私钥，也必须同时完成第 7.2 节的“公钥握手”，并在迁移结束后把旧公钥从服务器上删掉。

### 4.3 P1 代码与历史

**优先复用 github-export 已产出的 bundle**（见第 8 节），自己只补缺：

1. `k408-full.bundle`：`git bundle create k408-full.bundle --all`，然后 `git bundle verify` 必须通过。如果 github-export 已经产出且对应的 HEAD 与当前一致，直接复制并复核哈希，不要重复生成。
2. `k408-v20-uncommitted.patch`：`git diff --binary HEAD > ...`，同时附 `git status --porcelain=v1` 的清单（重命名、新增未跟踪文件要单独列出；未跟踪文件用 `git ls-files --others --exclude-standard` 列出并放进快照）。
3. `k408-worktree-snapshot.tar.zst`：工作树完整快照，排除 `node_modules`、`dist`、`tools/pc-model/build`、`__pycache__`、`.git`。这一份是“万一补丁打不上”的保险。
4. 如果 github-export 已经推送到 GitHub 私有仓库，在 MANIFEST 里写明仓库地址、分支、最新提交号，并标注“GitHub 上的是 v19 还是 v20”。

### 4.4 P2 资料包

一个或两个 `tar.zst`（≤450 MB 一个），内容：

- `prompts/`：`work/` 顶层 15 个 `*-prompt.md` 及对应 `.docx`，`promo/promo-prompt.*`，`promo2/` 整个目录，`splat-research.md`，`github/github-prompt.*`，本文件。
- `reports/`：`audit.md`、`audit.txt`、`scan-before/after.txt`、各目录下的 `REPORT.md`/`report.md`（`promo`、`rwd`、`rwd-react`、`todo-r17/audit`、`v19/rwd`、`v20/site0` 等），每轮挑 3～6 张代表性截图。
- `deploy/`：`.deploy/` 下除私钥以外的全部脚本（`d*.sh`、`d14-rollback.sh`、`e.sh`、`up.py`、`rx.py`、`harden/h1～h6`）、`k408.tgz`、`/workspace/deploy/vendor/`。注意 `e.sh` 里有用户邮箱，网站本来就公开展示它，可以保留；打包前用 gitleaks（`/workspace/work/github/bin/gitleaks`）扫一遍 P2，任何命中私钥或令牌的文件移出 P2、改放进 P0。
- `promo/`：两个成片 mp4、两张封面、`narration.json`、`build_timeline.py`、`compose.py`、`cover.py`、`gen_tts.py`、`mix.py`、`music.py`、`cap-*.cjs`、`REPORT.md`；`music/` 目录（9.2 M）。
- `pages/`：`built/sites/` 下 5 个页面目录，按页面标题重命名（`408知识立体图/`、`实拍电路板/`、`爆款小游戏/`、`小游戏大厅/`、`MiniGameArcade/`）；`built/widgets/` 两个目录。
- `games/`：`arcade/` 与根目录 8 张 png。
- `uploads-small/`：`files/uploads` 里除 4 本 PDF 外的 8 个文件。
- `scripts/`：`work/` 下的 `.cjs .mjs .js .py .sh .ts .bak` 工具脚本（排除 `node_modules`、`dist*`）。
- `面板重建说明.md`、`交接说明.md`（后者也单独交付一份纯文本，方便直接复制）。

明确排除：`work/cal.json`、`work/cal.err`、`work/brief/` 整个目录、所有 `node_modules`、`.trash`、`.pnpm-store`、`.hark`、`*.onnx`（进 P3）。

### 4.5 P3 大文件（分卷，最后交付）

- `P3a-textbooks`：4 本教材 PDF。PDF 本身已经压缩，用 `tar -cf -` 不再压缩，`split -b 450M -d` 切成 2 卷，命名 `k408-P3a-textbooks.tar.part00/01`。清单首行写“仅供个人复习备份，请勿传播”。
- `P3b-media`：`promo/voices/zh_CN-huayan-medium.onnx`（61 M，附它的来源与许可说明，若查不到就写“来源待核实”）、`promo/build/`（160 M）。
- `P3c-models`：`fullstack-408/tools/pc-model/build/`（261 M）、`work/gltf`（去掉 node_modules）、`work/pcb3d`、`work/splat`。附一句：这些可以用 `tools/pc-model/model.py` 等脚本重新生成，带走是为了省去重建时间。
- `P3d-shots`：其余各轮截图与调试目录（`v15～v20`、`rwd`、`toc`、`shots*`、`pw`、`todo-r17` 等，去掉 node_modules）。

P3 每一卷都单独算 SHA256；每个子包都附一个 `*.list.txt`（`tar -tvf` 的输出），让用户不下载也知道里面有什么。

---

## 5. 每个包的 SHA256、内容清单与恢复步骤

### 5.1 必须产出的三个文件

1. `SHA256SUMS.txt`：所有交付文件一行一个，格式与 `sha256sum` 输出一致，方便用户 `sha256sum -c` 校验。哈希不是机密，可以直接贴进给用户的消息里。
2. `MANIFEST.md`：每个包一节，写清：文件名、大小、SHA256、包含哪些目录与文件（数量）、刻意排除了什么以及为什么、恢复步骤。
3. 每个 tar 包旁边一个 `*.list.txt`。

### 5.2 恢复步骤模板（写进 MANIFEST）

- **P0**：用 7-Zip/Keka/ZArchiver 打开 `k408-P0-rescue-20261012.7z`，输入口令（由大哥本人保管）；Linux/Mac 上 `7z x k408-P0-rescue-20261012.7z`。私钥解出后执行 `chmod 600 keys/hark_408`，然后 `ssh -i keys/hark_408 root@154.8.183.93` 验证能登录。数据库恢复：把 dump 传到服务器后执行 `docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < k408-xxx.dump`（会覆盖现有数据，先用 h6 的方法在临时库演练）。
- **P1**：`git clone k408-full.bundle k408 && cd k408 && git apply --index ../k408-v20-uncommitted.patch`；补丁打不上就解压 `k408-worktree-snapshot.tar.zst` 覆盖工作树；然后 `pnpm install`、`pnpm -r build`。推到 GitHub：`git remote set-url origin <新地址> && git push -u origin --all`。
- **P2/P3 分卷**：`cat k408-P3a-textbooks.tar.part* | tar -xf -`；zst 包用 `zstd -d -c xxx.tar.zst | tar -xf -`。Windows 用户用 7-Zip 打开 `.part00` 即可（需提示：7-Zip 识别 `.001` 后缀更好，切分时可用 `split -b 450M --numeric-suffixes=1 -a 3` 生成 `.001/.002`，二选一并在 MANIFEST 写清）。

---

## 6. 新账号接续指南（写成 `新账号接续指南.md`，放进 P2，也单独交付）

### 6.1 《交接说明》的写法

由你全新撰写，中文，约 1500～2500 字，以“请记住以下关于我的信息”开头，用户在新账号第一句话粘贴给新 Hark。内容只写事实与偏好，不写任何关于记忆如何存放的描述，不写密码、令牌、私钥。建议包含：

- **我是谁**：王达，希望被称呼“大哥”；时区北京时间；邮箱 wda151050@gmail.com；用中文交流。
- **在做的主项目**：「考研408动画实验室」，面向国内考研同学的 C 端学习网站；全栈 pnpm monorepo（React 前端、Fastify＋Prisma＋PostgreSQL 后端、Caddy、docker compose）；线上 v19（提交 20912bb），v20 部署与服务器加固进行中（以 v20-deploy 的最终报告为准）；服务器为腾讯云轻量北京 2核2G、Ubuntu 24.04、目录 `/opt/k408`，暂用 IP 测试，ICP 备案办理中，备案后再接域名与 HTTPS，备案期间只自测不对外推广；联系邮箱显示 wda151050@gmail.com；线上还留着测试账号 e2e1791465270 待决定是否删除。
- **网站现状要点**：实验室 /lab 约 39 个动画实验、36 个过程图解、56 条性质与公式；/pc 整机拆解（真实感网格模型、手指滑动拆装）与“化身数据”第一人称访存路线；已去掉错题本、学习进度、自测题；有用户协议与隐私政策页。
- **我的偏好**：每一块新功能先写 ≥5000 字的执行 Prompt 再动手；视觉要“实用又好看”、功能优先、少装饰，讨厌“AI 味”设计（深色霓虹、紫色渐变、毛玻璃、emoji 图标）；网站上不出现所用技术的说明，也不写辅导书或教材出处；资源本地打包，不依赖国外 CDN；主力设备是横屏平板（约 1210 宽）和手机。
- **其他在做的事**：考研政治复习（希望按知识点之间的关联来记，关注时政题规律），两个每日面板；爆款小游戏页面（Poki 风格封面拼贴、暖白底、单一橙色点缀，不要老式经典小游戏）。
- **待办**：HTTPS 与域名（等备案）、v21 指纹加服务器侧盐、模型进一步压缩、真机帧率反馈、测试账号去留、迁移后的密钥轮换。
- **不要再提**：UNED 报名提醒（用户已明确不需要）。

### 6.2 新账号里的恢复顺序

1. 粘贴《交接说明》。
2. 重新连接 GitHub 与 Google 两个连接器；如需令牌，在新账号的安全表单里重新保存一个新的 GitHub 个人访问令牌，旧令牌到 GitHub → Settings → Developer settings 吊销。
3. 上传 P1（bundle＋补丁＋快照），让新 Hark 恢复到 `/workspace/fullstack-408` 并 `pnpm install`、构建、跑测试。若 GitHub 私有仓库已有完整代码，也可以直接从仓库克隆，再打 v20 补丁。
4. 完成第 7.2 节的“公钥握手”（如果在旧账号没做），或上传 P0 恢复旧私钥到 `/workspace/.deploy/hark_408`（权限 600）。
5. 上传 P2，把部署脚本放回 `/workspace/.deploy/`，验证 `rx.py` 能连上服务器并执行 `docker compose ps`。
6. 重建两个面板：把 `面板重建说明.md` 里每个面板的描述发给新 Hark，说“请在首页建一个这样的面板”。
7. 重建 Hark 页面：需要时把 P2 里对应页面的 `index.html` 上传，让新 Hark 以它为基础重新发布。
8. 定时任务与自建技能：本账号均为 0，无需重建。
9. 以后部署：沿用 `d14.sh` 的模式（先在服务器备份镜像与 `.env`，再上传源码包，后台串行构建），回滚用 `d14-rollback.sh`。

### 6.3 面板重建说明的内容

逐个写出：面板名、要展示的内容、每日刷新、数据来源网址与取数方法（知识链：zhenti.zalize.com 的科目频次页、考点页与分析题页，按 马原→毛中特/习思想→史纲→思修法基 轮换，3～5 个关联考点写“年份＋题型”，加一句口诀，带一个“考考我”按钮；时政：往年 2022～2026 卷 15/16/32/33/38 题主题与 16 分时政分值固定不常改，当前热点每天从 news.cn 等搜索并按重要性排序，附原文链接，五中全会召开后改为公报要点）。这些是用户自己的面板内容，可以写全。

---

## 7. 与 v20-deploy 的协调（最高优先级）

### 7.1 先查状态，再决定

执行者第一件事，用 `rx.py` 在服务器上只读执行：

```
sshd -T | grep -Ei '^(passwordauthentication|permitrootlogin|pubkeyauthentication)'
ls -l /etc/ssh/sshd_config.d/ ; cat /root/.ssh/authorized_keys | awk '{print $1, $3}'
ls -lt /var/backups/k408/ 2>/dev/null | head -3 ; cat /root/hardening-backup-latest 2>/dev/null
```

只打印公钥的类型与注释，不打印整行。

### 7.2 “公钥握手”（首选方案，私钥不用搬家）

1. 用户先在新 Hark 账号里说一句：“请生成一把 ed25519 SSH 密钥（注释 hark-new-408），私钥留在工作空间，权限 600，只把公钥给我看。”新 Hark 的沙箱如果没有 `ssh-keygen`，可以 `apt-get install -y openssh-client`，或用 Python `cryptography` 库生成 OpenSSH 格式密钥。
2. 用户把那一行**公钥**（以 `ssh-ed25519` 开头，可以公开）粘贴回当前旧账号的对话。
3. 旧账号执行者在用户同意后，用 `rx.py` 把它追加进服务器 `/root/.ssh/authorized_keys`（先备份该文件，追加后 `sort -u` 去重，权限 600），然后让用户回到新账号，请新 Hark 用新私钥执行一次 `ssh root@154.8.183.93 'hostname; docker compose -f /opt/k408/docker-compose.yml ps'` 验证。
4. 验证成功，迁移的“生死线”就过去了：新账号自带服务器访问权，旧私钥只是 P0 里的备份。迁移完成后，可在新账号里把旧公钥（注释 hark-deploy-408）从 `authorized_keys` 删掉。

### 7.3 对 h2（关闭 SSH 密码登录）的建议

- **建议暂缓 h2，直到以下任一条件满足：** ①公钥握手验证成功；②用户确认已下载 P0、能用口令解开、已用其中的私钥在自己电脑上登录成功一次。另外，无论哪种，都请用户亲自在腾讯云控制台点一次“登录 → 免密登录”，确认兜底可用。
- h1（配置备份）、h3（防火墙，已放行 22/80/443）、h4（fail2ban 与自动安全更新）、h5（数据库每日备份）、h6（恢复演练）不涉及登录方式，可以照常进行，而且 h5 越早跑，P0 越能拿到新鲜备份。
- 如果 h2 **已经执行**，不要为了迁移去回滚它（关掉密码登录本身是对的），只需要把公钥握手或 P0 交付提到最前面完成；真遇到进不去，按 ACCESS.md 用 OrcaTerm 免密登录删除 `00-k408-hardening.conf` 即可恢复密码登录。
- 你没有权限指挥 v20-deploy，只能在报告里给出上述建议，由派发你的上级去协调；如果发现 v20-deploy 正在执行 h2，不要去打断它的服务器会话。

---

## 8. 与 github-export 的协调

- github-export 按 `/workspace/work/github/github-prompt.md` 的默认方案往 `/workspace/work/github/export/` 产出：git bundle（完整历史）、周边资料包、上传说明。盘点时 `export/` 目录尚未生成，`export-stage/k408-archive/` 正在写入（已有 docs/prompts、docs/reports、promo 成片等）。
- **复用规则**：执行时先看 `export/` 是否已完成。已完成的 bundle，用 `git bundle verify` 和 `git bundle list-heads` 核对它的 HEAD 与当前 `git rev-parse HEAD` 一致，一致就直接作为 P1 的主体，不再重复生成；它的资料包如果覆盖了 P2 的某一部分，就在 P2 里引用它（写清文件名与哈希），不要重复打包同一批文件。
- **补充被排除项**：github-export 默认排除的东西，在本方案里的去向是：SSH 私钥 → P0；`.env`（服务器上的生产 `.env`）→ P0；四本教材 PDF → P3a；日历数据 → 不带（理由见 R7）；指纹清单 → P0；60 MB 语音模型 → P3b；`node_modules` 与构建产物 → 不带依赖，`tools/pc-model/build` 进 P3c。
- **别踩它的文件**：不要往 `/workspace/work/github/` 下写任何东西，不要读它正在写的半成品；如果它还没跑完，P1 先用自己生成的 bundle，在 MANIFEST 里注明“github-export 完成后以其为准”。
- 如果 github-export 推送 GitHub 仍是 403 等失败状态，P1 的 bundle 就是代码唯一的离线副本，必须确保它先于 P2/P3 交付。

---

## 9. 执行顺序（建议时间线）

1. 读本文件；`df -h /workspace` 确认剩余空间至少能放下约 2 GB 产物（不够就 P3 边打边交付、交付后删除该卷产物——只删 `work/migration/out/` 下自己产出的文件）。
2. 服务器状态只读检查（7.1）。
3. 向用户提出“公钥握手”与 h2 暂缓建议（这一步可以和下一步并行）。
4. 生成 P0：拉 `.env` 与数据库备份 → 整理 → 生成口令 → 加密 → 把口令交给用户保管 → 删临时口令 → 算哈希 → 交付 → 等用户确认解开。
5. 生成 P1：复用或生成 bundle → 补丁 → 快照 → 校验 → 交付。
6. 写《交接说明》、新账号接续指南、面板重建说明（这些是纯文本，直接交付，也放进 P2）。
7. 生成 P2：整理 → gitleaks 扫描 → 打包 → 分卷（如需要）→ 校验 → 交付。
8. 生成 P3（按用户决定的范围）→ 分卷 → 逐卷交付。
9. 写最终报告：每个包的名称、大小、SHA256、交付状态、未完成项。

---

## 10. 验收清单

- [ ] P0 的 7z 能用口令解开；解出的 `hark_408` 能登录服务器（由用户或新账号验证）；`.env` 与数据库备份文件非空，dump 能被 `pg_restore -l` 列出目录。
- [ ] 口令没有出现在任何聊天消息、文件名、交付文件内容里；沙箱临时口令文件已删除。
- [ ] 公钥握手完成，或用户明确选择只靠 P0；腾讯云 OrcaTerm 免密登录用户已亲测可用。
- [ ] `git bundle verify` 通过；从 bundle 克隆后能打上 v20 补丁，或快照能还原出与当前工作树一致的文件（抽查 `apps/api/src/app.ts`、`apps/web/legacy-src/` 等 v20 改动文件）。
- [ ] P2 经 gitleaks 扫描无私钥、无令牌；不含 `cal.json`、`brief/`、`node_modules`。
- [ ] 每个交付文件 ≤ 450 MB；`SHA256SUMS.txt` 覆盖全部交付文件，用户侧至少抽查 P0、P1 的哈希一致。
- [ ] 教材 PDF 只交给用户本人，未推送 GitHub、未上传任何公开位置，清单写明“仅供个人复习备份”。
- [ ] 《交接说明》不含密码、令牌、私钥，不描述记忆的组织方式；面板重建说明覆盖 2 个面板；清单写明自建技能 0、定时任务 0。
- [ ] 最终报告列出：已交付什么、没交付什么、用户还需要做的三件事（存口令、亲测控制台登录、迁移后轮换旧密钥与令牌）。

---

## 11. 需要用户决定的事项（共 3 项，均有默认值）

1. **P0 怎么交？**
   默认：私钥、`.env`、数据库备份、指纹清单一起打成 7z AES-256 加密包经聊天交付，口令随机生成后由你本人另行保管。
   备选：私钥两个文件不加密直接给你（其余仍加密）。

2. **h2（关闭服务器密码登录）什么时候做？**
   默认：先暂缓，等“新账号公钥握手”验证成功，或你确认已用 P0 里的私钥登录成功一次，再关；其余加固照常进行。

3. **P3 大文件带哪些？**
   默认：带教材 PDF（约 815 MiB，2 卷，仅个人备份）、语音模型与宣传片中间件、整机模型构建产物；过程截图只带每轮代表图，其余不带；依赖目录与回收站不带。全部经聊天分卷交付（每卷 ≤450 MB）。
   备选：只带教材 PDF；或在你同意后改为上传到你自己的 Google Drive（只用于个人备份，不分享）。

---

## 12. 交付给用户时怎么说（示范，简短）

- 先说结论：“救命包、代码、资料、大文件分四批给你，第一批最重要，请先存好。”
- 每批说清：文件名、大小、SHA256 前 12 位、怎么打开。
- P0 只提醒“口令由你本人保管，存进密码管理器”，绝不说口令。
- 最后一句只提一件下一步：“现在在新账号里让 Hark 生成一把 SSH 密钥，把公钥贴回来，我帮你加到服务器上，这样换号后服务器不会失联。”
