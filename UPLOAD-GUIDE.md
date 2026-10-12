---
title: 考研408动画实验室 · 上传到 GitHub 私有仓库 · 手把手指南
date: 2026-10-12
---

# 考研408动画实验室：上传到 GitHub 私有仓库（手把手指南）

这份指南带你把整个项目上传到你自己的 GitHub 私有仓库 `pluto-da/k408-lab`。全程大约 15 分钟。

## 0. 你下载到的文件

| 文件 | 是什么 |
|---|---|
| `k408-lab.bundle` | 主代码仓库的**完整 git 历史**：所有提交、所有分支、所有标签。一个文件就能还原出整个仓库 |
| `k408-archive-*.zip` | 周边资料：各版 Prompt、报告、部署和加固脚本、宣传视频成片、封面、视频脚本 |
| `SHA256SUMS.txt` | 上面每个文件的校验值，用来确认下载没有损坏 |
| `UPLOAD-GUIDE.md` / `.docx` | 就是本指南 |

> **本次 bundle 的内容（2026-10-12 18:00 导出）**：24 个提交，1 个分支 `master`，最新提交 `20912bb v19: data ride UI redesign`。**不含 v20**：导出时 v20 还在开发、没有提交，也还没有 v20 标签；bundle 里也没有任何标签，所以第 2 节的 `git push --tags` 这一次会显示 “Everything up-to-date”，属于正常。v20 的未提交改动另外放在迁移包 P1 里（`k408-v20-uncommitted.patch` 和工作树快照），恢复后提交即可推送。

先把这些文件放进同一个文件夹，比如 `D:\k408`（Windows）或 `~/k408`（Mac）。

### 0.1 校验下载是否完整（推荐）

Mac 或 Linux 终端：
```bash
cd ~/k408
shasum -a 256 -c SHA256SUMS.txt
```
每一行都显示 `OK` 就对了。

Windows PowerShell（逐个文件比对，输出的值要和 `SHA256SUMS.txt` 里的一样）：
```powershell
cd D:\k408
Get-FileHash .\k408-lab.bundle -Algorithm SHA256
```

### 0.2 需要先装好的软件

- **Git**：https://git-scm.com/downloads （Windows 安装时一路“下一步”即可，会附带 Git Bash 和凭据管理器）。装好后在终端输入 `git --version`，能看到版本号就行。
- 可选：**GitHub Desktop**（不想敲命令就用它，见第 4 节）：https://desktop.github.com
- 可选：**Git LFS**（只有当你想把大于 100 MB 的文件放进仓库时才需要）：https://git-lfs.com

---

## 1. 在 GitHub 网页上建一个空的私有仓库

1. 浏览器打开 https://github.com/new ，用账号 `pluto-da` 登录。
2. **Repository name** 填：`k408-lab`
3. **Description**（可选）填：`考研408动画实验室 · 私有全量仓库`
4. 选择 **Private**（私有）。⚠️ 一定要选 Private，不要选 Public。
5. 下面三个选项**全都不要勾**：
   - ☐ Add a README file
   - ☐ Add .gitignore（保持 None）
   - ☐ Choose a license（保持 None）
   
   原因：仓库必须是完全空的，否则第一次推送会因为历史不一致被拒绝。
6. 点 **Create repository**。
7. 确认页面左上角仓库名旁边有一个灰色的 **Private** 标记。

---

## 2. 用命令行把完整历史推上去

打开终端（Windows 用 **Git Bash**，Mac 用“终端”），逐行执行：

```bash
# 进入放文件的文件夹（Windows 的 Git Bash 里 D:\k408 写成 /d/k408）
cd ~/k408

# 1) 先检查 bundle 文件是否完好，应显示 "is okay"
git bundle verify k408-lab.bundle

# 2) 从 bundle 克隆出完整仓库
git clone k408-lab.bundle k408-lab
cd k408-lab

# 3) 把所有分支都建成本地分支（bundle 里如果只有 master 一个分支，这一步不会做任何事）
for b in $(git branch -r | grep -v HEAD | sed 's#origin/##'); do git branch --track "$b" "origin/$b" 2>/dev/null; done

# 4) 把远程地址从 bundle 文件改成你的 GitHub 仓库
git remote set-url origin https://github.com/pluto-da/k408-lab.git
git remote -v        # 应显示两行 https://github.com/pluto-da/k408-lab.git

# 5) 推送全部分支和全部标签
git push --all origin
git push --tags origin
```

**第一次推送时会要求登录 GitHub：**
- Windows：会弹出浏览器窗口，点 **Sign in with your browser** 授权即可。
- Mac / Linux：用户名填 `pluto-da`，**密码处不能填 GitHub 登录密码**，要填一个 Personal Access Token（个人访问令牌）：
  1. 打开 https://github.com/settings/tokens?type=beta → **Generate new token**；
  2. Repository access 选 **Only select repositories** → 勾 `k408-lab`；
  3. Permissions 里把 **Contents** 和 **Workflows** 设为 **Read and write**（仓库里有 `.github/workflows/ci.yml`，没有 Workflows 权限会被拒绝）；
  4. 生成后复制这串令牌，粘贴到终端的密码处（粘贴时屏幕上不显示字符，是正常的）。
  
  令牌只显示一次，不要发到聊天里，也不要写进任何文件。

**推送成功后检查：**
- 网页上刷新仓库，能看到代码和提交记录；
- 点 **Tags**（或 https://github.com/pluto-da/k408-lab/tags ），能看到版本标签；
- 在终端执行 `git log --oneline | wc -l`，数字应和本包说明里写的提交数一致。

> 推送后 GitHub Actions 会自动运行一次 CI（安装、类型检查、测试、构建）。私有仓库每月有 2000 分钟免费额度，正常够用。CI 失败不影响仓库内容，不用担心。

---

## 3. 上传资料包（二选一）

资料包 `k408-archive-*.zip` 里的文件都小于 100 MB，两种方法都能用。

### 方法 A：放进 Release 附件（推荐，最简单）

Release 附件不占仓库体积，也不占 Git LFS 额度，单个文件最大 2 GB。

1. 打开 https://github.com/pluto-da/k408-lab/releases/new
2. **Choose a tag**：输入 `archive-2026-10-12`，点 **Create new tag: archive-2026-10-12 on publish**；Target 选 `master`。
3. **Release title** 填：`全量资料归档 2026-10-12`
4. 说明栏可以写：`各版 Prompt、报告、部署脚本、宣传视频。解压后看 README.md。`
5. 把 `k408-archive-*.zip`、`SHA256SUMS.txt` 拖进页面下方的 **Attach binaries** 区域，等进度条走完。
   - 也可以把 `k408-lab.bundle` 一起传上去，作为整个仓库的备份。
6. 点 **Publish release**。

（Release 在私有仓库里同样是私有的，只有你能看到。）

### 方法 B：放进一个独立的 archive 分支

这样资料和代码在同一个仓库里，可以直接在网页上浏览每个文件，而且和代码历史互不干扰。

```bash
cd ~/k408/k408-lab

# 建一个没有任何历史的“孤儿”分支
git switch --orphan archive
git rm -rf --cached . -q 2>/dev/null
# 清空工作区里 master 的文件（只删工作区，不影响 master 分支）
git clean -fdq
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

# 解压资料包到这里（Windows 也可以右键“全部解压”到这个文件夹）
unzip ../k408-archive-*.zip
ls      # 应看到 README.md、SECRETS.md、docs、deploy、promo、promo2

git add -A
git commit -m "archive: 过程资料、Prompt、报告、部署脚本、宣传视频"
git push -u origin archive

# 切回代码分支
git switch master
```

**如果以后有大于 100 MB 的文件**（GitHub 会直接拒收超过 100 MB 的单个文件，超过 50 MB 会警告）：
- 最简单：放进 Release 附件（方法 A）。
- 或者用 Git LFS，在 `git add` 之前执行：
  ```bash
  git lfs install
  git lfs track "*.mp4" "*.pdf" "*.zip"
  git add .gitattributes
  ```
  之后正常 `git add`、`git commit`、`git push` 即可。免费账号的 LFS 额度是 10 GiB 存储、每月 10 GiB 下载。

---

## 4. 不想敲命令：用 GitHub Desktop

GitHub Desktop 不能直接打开 `.bundle` 文件，所以只有第一步需要一条命令，后面全是点鼠标。

1. 安装并打开 GitHub Desktop，菜单 **File → Options → Accounts**（Mac 是 **GitHub Desktop → Settings → Accounts**），点 **Sign in** 登录 `pluto-da`。
2. 在 Git Bash / 终端里执行这一条（把 bundle 还原成普通文件夹）：
   ```bash
   cd ~/k408 && git clone k408-lab.bundle k408-lab
   ```
3. GitHub Desktop 菜单 **File → Add local repository…**，选择 `k408-lab` 文件夹，点 **Add repository**。
4. 改远程地址：菜单 **Repository → Repository settings… → Remote**，把 Primary remote repository (origin) 改成  
   `https://github.com/pluto-da/k408-lab.git`，点 **Save**。
   - 如果你还没在网页上建仓库，也可以跳过第 1 节：直接点顶部的 **Publish repository**，名字填 `k408-lab`，**务必勾选 “Keep this code private”**，再点 Publish。
5. 点顶部的 **Push origin**（或 **Publish branch**）。
6. ⚠️ GitHub Desktop **不会推送标签**。推送完成后，再在终端里执行一次：
   ```bash
   cd ~/k408/k408-lab && git push --tags origin
   ```
   或者不推标签也行，代码和历史都已经上去了，只是网页上看不到版本号。
7. 资料包用第 3 节方法 A（网页拖拽上传）最省事。

---

## 5. 推送完成后的安全设置（建议都做）

1. **确认是私有**：仓库 **Settings → General** 拉到最底部 Danger Zone，应显示 “This repository is currently private”。以后**不要改成公开**：仓库里有服务器 IP、部署流程、内部报告。
2. **开启两步验证**：https://github.com/settings/security → Two-factor authentication。账号被盗是私有仓库泄露最常见的原因。
3. **Actions 权限设为只读**：仓库 **Settings → Actions → General → Workflow permissions** 选 **Read repository contents and packages permissions**，保存。
4. **开启 Dependabot 漏洞提醒**（免费）：**Settings → Code security** → Dependabot alerts → Enable。
5. **不要添加协作者**，不要开启 Pages。
6. **检查第三方授权**：https://github.com/settings/applications ，把不认识或不再使用的应用撤销。用完的个人访问令牌可以在 https://github.com/settings/tokens 删除。
7. 免费账号的私有仓库**没有**分支保护和 Secret scanning，所以：以后提交前自己留意，不要把 `.env`、私钥（`BEGIN OPENSSH PRIVATE KEY` 开头的文件）、数据库备份加进仓库。仓库自带的 `.gitignore` 已经忽略了 `.env` 和 `backups/`。

---

## 6. 密钥存放说明

本包里**没有任何真实密钥**，这是故意的：

- **服务器 SSH 私钥**：只在 Hark 工作区里，没有放进包。需要自己部署时，在电脑上生成新密钥，通过云厂商控制台把公钥加到服务器。
- **生产 `.env`（数据库密码、JWT 密钥）**：只在服务器 `/opt/k408/.env`。包里只有模板 `.env.example`。
- **防扒指纹清单**：没有放进包，放进去会让指纹失去取证作用。
- **生产数据库备份**：含用户个人信息，永远不要上传。

详细说明（每个密钥的用途、位置、丢了怎么重新生成）见资料包里的 `SECRETS.md`。

**万一不小心把密钥推上去了**：先换密钥（服务器换 SSH 密钥、改数据库密码和 JWT_SECRET 并重新部署），再清理仓库历史。仅仅删除文件或删除仓库是不够的，必须当作已经泄露处理。

---

## 7. 以后怎么同步新版本

每次 Hark 做完一个新版本，你可以让 Hark 再导出一个新的 bundle，然后：

```bash
cd ~/k408/k408-lab
git pull ~/Downloads/k408-lab.bundle master    # 从新 bundle 拉取新提交
git fetch ~/Downloads/k408-lab.bundle 'refs/tags/*:refs/tags/*'
git push origin master
git push --tags origin
```

只要不强推（不用 `git push -f`），就不会丢失任何历史。

## 8. 常见问题

| 现象 | 原因和解决办法 |
|---|---|
| `! [rejected] master -> master (fetch first)` | 建仓库时勾了 README。最简单的办法：在网页上删掉这个仓库（Settings → Danger Zone → Delete），按第 1 节重新建一个空的 |
| `refusing to allow a Personal Access Token to create or update workflow` | 令牌缺少 Workflows 权限，按第 2 节重新生成令牌并勾上 Workflows: Read and write |
| `remote: Permission to pluto-da/k408-lab.git denied` | 登录的不是 `pluto-da` 账号，或令牌没勾这个仓库。Windows 可在“凭据管理器”里删掉旧的 github.com 凭据后重试 |
| `File ... exceeds GitHub's file size limit of 100.00 MB` | 有文件超过 100 MB，改用 Release 附件或 Git LFS（第 3 节） |
| `git bundle verify` 报错 | 下载不完整，重新下载并用 `SHA256SUMS.txt` 校验 |
