# 04 · Prompt 与报告索引

这份文档列出旧账号写过的全部执行 Prompt 和主要报告，方便你查某一版为什么这样做。路径都在 `archive` 分支；汉字数由脚本统计（2026-10-12）。Prompt 正文不在这里复述。

## 执行 Prompt

| 文件 | 版本 | 主题 | 汉字数 | docx | 触发原话（摘要） | 结果 |
|---|---|---|---|---|---|---|
| `docs/prompts/cn-prompt.md` | v12 | 计算机网络动画实验与过程图解 | 5042 | 有 | “就差计算机网络的动画实验和图解了” | v12 48fde11 |
| `docs/prompts/coos-prompt.md` | v12 | 组成原理与操作系统实验扩充 | 5073 | 有 | “组成原理和操作系统也要有动画实验和图解” | v12 48fde11 |
| `docs/prompts/ds-prompt.md` | v13 | 数据结构实验与图解 | 5095 | 有 | “数据结构的动画实验怎么少这么多东西” | v13 c19bcc9 |
| `docs/prompts/final-check-security-prompt.md` | v20 | 最终深度检查与安全加固 | 5056 | 有 | “不能让人把代码扒下来” | v20 58f206a |
| `docs/prompts/github-prompt.md` | — | 打包上传 GitHub 私有仓库 | 6706 | 有 | “全部打包放到GitHub上，私密” | 改走下载包，后用部署密钥推送 |
| `docs/prompts/migration-prompt.md` | — | 换号全量迁移打包 | 7657 | 有 | “是全部吗？因为我要换账号了” | 迁移包 P0～P3 |
| `docs/prompts/handoff-prompt.md` | — | 换号交接入口（本目录） | 8212 | 有 | “直接能用的不用浪费时间” | archive 的 handoff/ |
| `docs/prompts/pc-orbit-prompt.md` | v9 | 部件观察：绕着元件转、松手就停 | 5026 | 无 | “手指滑动之后都跑没了” | 3330c2f |
| `docs/prompts/proc-prompt.md` | v10/v11 | 过程图解模块 | 5063 | 有 | “加法器和译码器，带TLB……” | 2118532 |
| `docs/prompts/promo-prompt.md` | — | 第一版宣传片 | 5537 | 有 | “做一个宣传视频” | 竖屏约 48 秒、横屏约 79 秒 |
| `docs/prompts/promo2-prompt.md` | — | 第二版宣传片（仿 Linear 发布片） | 10586 | 有 | “磕磕绊绊……声音还AI” | 未执行，等配音方案 |
| `docs/prompts/prop-prompt.md` | v14 | 性质与公式 | 5605 | 有 | “性质也能加上去” | v14 29c18e5 |
| `docs/prompts/redesign-prompt.md` | v8 | “实用又好看”改版 | 5668 | 无 | “感觉有点花里胡哨” | v8 dcc02e6 |
| `docs/prompts/ride-layout-prompt.md` | v18 | 化身数据遮挡优化 | 5024 | 有 | “这都挡住了” | v18 516667f |
| `docs/prompts/ride-prompt.md` | v17 | 化身数据第一人称游走 | 5075 | 有 | “化为类似数据一样的第一人称视角” | v17 19f8daf |
| `docs/prompts/ride-ui-prompt.md` | v19 | 化身数据界面精修 | 5076 | 有 | “能把UI设计的更好吗” | v19 20912bb |
| `docs/prompts/rwd-prompt.md` | v15 | 多设备适配 | 5045 | 有 | “适配不同型号的平板，电脑，手机” | v15 71dd65f |
| `docs/prompts/splat-research.md` | v3 | 高斯泼溅整机素材与工具调研（英文） | 18（英文） | 无 | “用blender建模再高斯” | v3 598f6f8，后被网格方案取代 |
| `docs/prompts/src-prompt.md` | v16 | 去除辅导书痕迹 | 5006 | 有 | “不能让别人发现咱们是用王道的书” | v16 514658c |
| `docs/prompts/toc-prompt.md` | v16 | 侧边目录下拉折叠 | 5005 | 有 | “侧边栏这里增加下拉式选项” | v16 514658c |
| `docs/prompts/todo-prompt.md` | v17a | 未完成事项清点与收尾 | 4996（略低于 5000，如实标注） | 有 | “检查下还有哪些你没有执行” | v17a 7ae56fb |

> pc-orbit、redesign 两份当时没有生成 docx；splat-research 是英文调研笔记，不是执行 Prompt。

## 报告

| 文件 | 一句话结论 |
|---|---|
| `docs/reports/v20/report.md` | v20 最终检查与安全加固报告：全站审计通过、防扒做到的程度、服务器加固状态（h2 暂缓）、遗留事项 |
| `docs/reports/promo__REPORT.md` | 第一版宣传片交付说明：两版成片参数、旁白语音来源与授权提醒、配乐 |
| `docs/reports/rwd__REPORT.md` | 实验室旧版模块的多设备适配报告（v15） |
| `docs/reports/rwd-react__REPORT.md` | React 外壳多设备适配报告：触控小目标 969→0 等前后对比（v15） |
| `docs/reports/rwd-react__after-report.md` | v15 适配后逐视口审计表 |
| `docs/reports/v19__rwd__report.md` | v19 逐视口审计表 |
| `docs/reports/todo-r17__audit__report.md` | v17 收尾时逐视口审计表 |
| `docs/reports/audit.md` | 10-09 全站审计与修复（v6 前后）：类型检查、测试、真机视口点按测试 |
| `docs/reports/scan-before.txt / scan-after.txt` | v16 去教材出处前后的敏感词扫描对比 |
| `docs/reports/screenshots/` | 各版代表截图 |

## 部署与加固脚本

| 文件 | 作用 |
|---|---|
| `deploy/d14.sh` | v20 正式部署：备份 v19 镜像与源码 → 换源码 → 后台串行构建 → 启动 |
| `deploy/d15.sh` | v20 修复部署（d14 的 Caddy 校验失败后重跑，不再重复备份） |
| `deploy/d14-rollback.sh` | 回滚到 v19 镜像 |
| `deploy/harden/h1～h6` | 服务器加固；h1、h3～h6 已执行，**h2 未执行** |
| `deploy/rx.py`、`deploy/up.py` | 远程执行与上传；私钥路径读环境变量 `K408_SSH_KEY`，主机读 `K408_HOST` |
