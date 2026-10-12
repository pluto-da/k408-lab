> **已过时，以 `handoff/` 为准。** 本文件写于 2026-10-12 v20 上线之前，仅作历史留存与迁移包校验参考。主要勘误：线上已是 v20（BUILD_ID v20-58f206a），v20 已提交并打 tag，补丁和工作树快照不再需要；测试账号 e2e1791465270 已备份后删除；服务器加固 h1、h3～h6 已执行，**h2 未执行，SSH 密码登录仍开着**；代码与资料已推送到 GitHub 私有仓库 pluto-da/k408-lab；P3 分卷实际名称是 `k408-P3a-textbooks.tar.001/.002`；P0 口令的存放位置不在仓库中记录。

# k408 账号迁移包清单（2026-10-12 18:03 北京时间）

所有文件的 SHA256 见同目录 `SHA256SUMS.txt`（`sha256sum -c SHA256SUMS.txt` 校验）。每个文件都 ≤ 450 MB（450,000,000 字节）。

## P0 救命包（最先存好）
**`P0/k408-P0-rescue-20261012.7z`**，5,295 字节，SHA256 `a4b30cff99c9…`
- 7z 格式，AES-256 加密，**文件名也加密**（不输口令连文件列表都看不到）。口令由大哥本人保管（存放位置不在仓库中记录）。
- 内容（9 个文件）：`keys/hark_408`(+.pub，服务器 root 私钥 hark-deploy-408)、`keys/id_ed25519`(+.pub，hark-deploy-408b，已核实同样在服务器 authorized_keys 里)、`server/prod.env`（2026-10-12 从 /opt/k408/.env 拉取）、`server/db/k408-20261012-095643.dump`（现场 pg_dump -Fc 导出，北京时间 17:56）、`fingerprints/fingerprints.json`、`fingerprints-test.json`、`ACCESS.md`（登录、兜底、数据库恢复说明）。
- 服务器上没有 `/root/k408.env.v19-*` 备份，也还没有每日备份目录（h5 未执行），所以 .env 和数据库各只有这一份现场导出。
- 打开：Windows 用 7-Zip，Mac 用 Keka，安卓用 ZArchiver，Linux `7z x k408-P0-rescue-20261012.7z`。私钥解出后 `chmod 600 keys/hark_408`，`ssh -i keys/hark_408 root@154.8.183.93`。

## P1 代码与历史
| 文件 | 大小 | 内容 |
|---|---|---|
| `P1/k408-full.bundle` | 33,680,324 | `git bundle --all`：24 个提交，1 个分支 master，HEAD `20912bb v19`，无标签。`git bundle verify` 通过；临时目录 clone 出 24 个提交，与原仓库一致 |
| `P1/k408-v20-uncommitted.patch` | 209,997 | `git diff --binary HEAD`：106 个文件，+1541 −352（导出于北京时间 17:58）。已验证可在 bundle 克隆上 `git apply --check --index` 通过 |
| `P1/k408-v20-status.txt` | 6,413 | `git status --porcelain` 与未跟踪文件清单（补丁不含未跟踪文件，需从快照取） |
| `P1/k408-worktree-snapshot.tar.zst` | 15,165,487 | 工作树完整快照（含 v20 未提交改动和 3 个未跟踪文件），排除 node_modules、dist、tools/pc-model/build、.git、.env |
| `P1/k408-worktree-snapshot.list.txt` | 29,654 | 快照文件清单 |

**v20 状态**：导出时 v20 仍在开发，没有提交、没有 v20 标签。v20 完成后建议重新导出一次 bundle。
恢复：`git clone k408-full.bundle k408 && cd k408 && git apply --index ../k408-v20-uncommitted.patch`，再从快照补上未跟踪文件；补丁打不上就用快照覆盖工作树：`zstd -dc k408-worktree-snapshot.tar.zst | tar -xf -`。

## P2 资料包
**`P2/k408-P2-materials.tar.zst`**，85,953,448 字节，469 个文件（清单 `k408-P2-materials.list.txt`）。gitleaks 8.21.2 扫描：no leaks found；另用 grep 查私钥头和生产密码赋值：0 处。
- `docs/prompts/`：各版 Prompt md/docx（cn、coos、ds、proc、prop、redesign、ride、ride-layout、ride-ui、rwd、src、toc、todo、pc-orbit、final-check-security、splat-research、promo、promo2、github、migration）
- `docs/reports/`：audit、扫描前后对比、各版 REPORT，v20 报告/脚本/日志和关键截图（不含指纹）
- `deploy/`：d.sh～d14.sh、d14-rollback.sh、e.sh、harden/h1～h6、rx.py/up.py（私钥路径改为环境变量 K408_SSH_KEY）、.env.example、k408.tgz、vendor/
- `promo/`：两版成片 mp4、两张封面、narration.json、脚本、music/、qa 质检图；`promo2/`：Prompt 和脚本
- `pages/`：5 个页面（408知识立体图、实拍电路板、爆款小游戏、小游戏大厅、MiniGameArcade）；`panels/`：2 个面板的资料
- `games/`：arcade/ 和 8 张封面/主视觉 png；`uploads-small/`：除教材 PDF 外的 8 个上传文件
- `scripts/`：work 下的工具脚本（157 个）
- `README.md`、`SECRETS.md`、`交接说明.md`、`面板重建说明.md`、`新账号接续指南.md`
恢复：`zstd -dc k408-P2-materials.tar.zst | tar -xf -`（Windows 用 7-Zip 25 及以上或 PeaZip 直接打开 .zst）。

## P3 大文件
| 文件 | 大小 | 内容 |
|---|---|---|
| `P3/k408-P3a-textbooks.tar.001` + `.002` | 450,000,000 + 404,763,520 | 4 本王道 2027 教材 PDF。**仅供个人复习备份，请勿传播，不要上传 GitHub 或任何公开位置**。合并：`cat k408-P3a-textbooks.tar.0* | tar -xf -`；Windows 用 7-Zip 打开 `.001` |
| `P3/k408-P3b-media.tar.zst` | 279,769,084 | 宣传片中间文件：Piper 语音模型 zh_CN-huayan-medium.onnx（来源 https://huggingface.co/rhasspy/piper-voices/tree/main/zh/zh_CN/huayan/medium ，许可以该页为准）、promo/build、tts、shots、explore、qa |
| `P3/k408-P3c-models.tar.zst` | 132,713,220 | 整机模型构建产物 pc-model-build（原 tools/pc-model/build，261 MB）、work/gltf（去掉 node_modules）、pcb3d、splat。可用 tools/pc-model 的脚本重新生成，带着是为了省时间 |
| `*.list.txt` | — | 各包文件清单 |

## 单独交付的说明
`交接说明.md`（新账号第一句话粘贴给 Hark）、`新账号接续指南.md`、`面板重建说明.md`。

## 刻意没有带的
- node_modules、.pnpm-store、.trash、.hark、各处 dist 中间产物
- 个人日历/邮件原始数据副本（work/cal.json、cal.err、work/brief/）：数据本身仍在你的 Google 账号里
- 其余过程截图与调试目录（v15～v20 的大量截图、tb*/site* 构建副本、rwd/toc 的 dist 前后对比等）：按默认只带每轮代表截图（已在 P2）
- 旧账号保险箱里的 GitHub 令牌（无法也不应导出，新账号重新保存）
- 自建技能：无；定时任务：无

## 2026-10-12 19:05 补充
- P1/k408-full-v20.bundle：完整历史 + 标签 v20（提交 58f206a，已上线版本），SHA256 f889770473d6ecb8dc3f6802052acc5937ed13dd198ee4a69a7f920633c0d270。有了它，P1/k408-v20-uncommitted.patch 与快照不再需要用于恢复 v20。
