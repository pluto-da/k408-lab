# 考研408动画实验室 · 周边资料包（k408-archive）

这是主代码仓库（`k408-lab.bundle`）之外的全部过程资料。代码、部署配置（docker-compose、Caddy、Dockerfile、CI、`.env.example`）和完整 git 历史都在 bundle 里，这里放的是仓库外的东西。

## 目录

| 目录 | 内容 |
|---|---|
| `docs/prompts/` | 每一版的需求 Prompt（md 和 docx）：cn、coos、ds、proc、prop、redesign、ride、ride-layout、ride-ui、rwd、src、toc、todo、pc-orbit、final-check-security、splat-research，以及宣传视频（promo、promo2）和本次打包（github）的 Prompt |
| `docs/reports/` | 审计报告 `audit.md`/`audit.txt`、安全扫描前后对比 `scan-before.txt`/`scan-after.txt`、各版 REPORT（文件名里的 `__` 代表原来的目录层级），`screenshots/` 里是关键截图 |
| `docs/reports/v20/` | v20 的审计报告、审计和测试脚本、日志、关键截图（不含防扒指纹清单） |
| `deploy/` | 部署脚本 d.sh、d2 到 d14、d14-rollback.sh、e.sh；`harden/` 下 7 个服务器加固脚本（h1 备份 → h2 SSH 只允许密钥 → h3 ufw → h4 fail2ban → h5 每日备份 cron → h6 恢复演练，h2-rollback 是回滚）；`rx.py`/`up.py`（paramiko 远程执行和上传，私钥路径已改成环境变量）；`.env.example` 模板 |
| `promo/` | 宣传视频成片 `promo-16x9.mp4`（横屏）、`promo-9x16.mp4`（竖屏），两张封面，`narration.json`（旁白文案和时间轴），`scripts/`（录屏 cap-*.cjs、合成 compose.py、build_timeline.py、混音 mix.py、配乐 music.py、封面 cover.py、TTS gen_tts.py 等），`qa/` 抽帧质检图 |
| `promo2/` | 第二版宣传视频的 Prompt 和脚本 |
| `SECRETS.md` | 每个密钥的用途、存放位置、丢失后怎么重新生成（不含任何值） |

## 未包含的内容及去向

| 内容 | 原因 | 去向 |
|---|---|---|
| 服务器 SSH 私钥 `hark_408`、`id_ed25519` 及公钥 | 泄露等于交出服务器 root 权限 | 只在 Hark 工作区 `/workspace/.deploy/` |
| 生产 `.env` | 含数据库密码和 JWT 密钥 | 只在服务器 `/opt/k408/.env` |
| v20 防扒指纹清单 `fingerprints*.json` | 公开后指纹失去取证作用 | 只在 Hark 工作区 `work/v20/` |
| 4 本王道 2027 教材 PDF（每本 188 到 225 MB） | 版权出版物，且超过 GitHub 单文件 100 MB 上限 | 你本地有原件 |
| 个人日历数据 `cal.json`、`brief/*.json` | 个人隐私，与项目无关 | 不导出 |
| Piper 中文语音模型 `zh_CN-huayan-medium.onnx`（60 MB） | 第三方模型，可重新下载 | https://huggingface.co/rhasspy/piper-voices/tree/main/zh/zh_CN/huayan/medium |
| 宣传视频合成中间文件（promo/build、shots、tts、music 音频、explore） | 体积大（约 270 MB），可由脚本重新生成 | 仍在 Hark 工作区 `work/promo/` |
| 大量过程截图、dist 前后副本、实验模型、`tools/pc-model/build`（261 MB） | 体积大，可从对应版本重新构建 | 仍在 Hark 工作区，需要时可另行打包 |
| `/workspace/.deploy/k408.tgz` | 某次部署用的源码包，内容已在 git 历史里 | 不导出 |
| 生产数据库备份 | 含用户个人信息 | 永远不上传 |
