# Git 协作流程说明

这份文档给项目成员使用，主要说明：如何第一次拉取项目、如何日常提交代码、如何同步别人提交的代码，以及常见 Git 命令的作用。

## 一、第一次拉取项目

如果是第一次参与这个项目，先在电脑上找一个统一放项目的目录，例如：

```bash
mkdir -p ~/project
cd ~/project
```

然后执行克隆命令：

```bash
git clone https://github.com/longlong5575/watersupplyassessment.git
```

进入项目目录：

```bash
cd watersupplyassessment
```

查看当前状态：

```bash
git status
```

如果能正常看到 `On branch main`，说明仓库已经拉取成功。

## 二、每天开始写代码前

开始工作前，建议先把 GitHub 上最新代码拉下来：

```bash
git pull origin main
```

作用：把远程仓库 `main` 分支上的最新代码同步到本地，避免自己基于旧代码开发。

## 三、日常提交代码流程

修改完代码后，先查看改了哪些文件：

```bash
git status
```

把需要提交的文件加入暂存区：

```bash
git add .
```

作用：把当前目录下的修改加入本次提交。

提交代码：

```bash
git commit -m "说明这次修改了什么"
```

示例：

```bash
git commit -m "新增管网评估数据处理脚本"
```

推送到 GitHub：

```bash
git push origin main
```

作用：把本地提交推送到远程仓库，其他同事才能拉到你的修改。

## 四、完整日常流程

最常用的一套流程是：

```bash
git pull origin main
git status
git add .
git commit -m "本次修改说明"
git push origin main
```

建议每次提交信息写清楚一点，不要只写 `update`、`test`。

## 五、查看改动

查看当前有哪些文件被修改：

```bash
git status
```

查看具体改了什么内容：

```bash
git diff
```

查看已经加入暂存区的改动：

```bash
git diff --staged
```

## 六、查看历史记录

查看提交历史：

```bash
git log --oneline
```

查看当前分支：

```bash
git branch --show-current
```

查看远程仓库地址：

```bash
git remote -v
```

## 七、撤销操作

撤销某个文件的本地修改：

```bash
git restore 文件名
```

示例：

```bash
git restore README.md
```

注意：这个命令会丢弃本地未提交的修改，执行前要确认这个修改确实不要了。

把已经 `git add` 的文件从暂存区拿出来：

```bash
git restore --staged 文件名
```

示例：

```bash
git restore --staged README.md
```

这个命令不会删除文件内容，只是取消本次提交的暂存状态。

## 八、临时保存修改：git stash

如果你代码改到一半，还不想提交，但又需要先拉取远程最新代码，可以使用：

```bash
git stash
```

作用：临时保存当前未提交的修改，让工作区恢复干净。

常见流程：

```bash
git stash
git pull origin main
git stash pop
```

含义：

1. `git stash`：先把本地未提交的修改临时收起来。
2. `git pull origin main`：拉取远程最新代码。
3. `git stash pop`：把刚才临时保存的修改恢复回来。

查看 stash 列表：

```bash
git stash list
```

带说明保存：

```bash
git stash push -m "某某功能开发到一半"
```

如果有新建文件也想一起 stash：

```bash
git stash -u
```

## 九、.gitignore 是什么

`.gitignore` 用来告诉 Git：哪些文件或文件夹不要提交到仓库。

例如：

```gitignore
/本地资料/
__pycache__/
*.pyc
.DS_Store
.env
```

含义：

- `/本地资料/`：忽略项目根目录下的 `本地资料` 文件夹。
- `__pycache__/`：忽略 Python 缓存文件夹。
- `*.pyc`：忽略 Python 编译缓存文件。
- `.DS_Store`：忽略 macOS 自动生成的系统文件。
- `.env`：忽略本地环境变量文件，通常里面可能有账号、密码、密钥。

注意：`.gitignore` 只对还没有被 Git 跟踪的文件生效。如果某个文件已经提交过，后来再写进 `.gitignore`，Git 仍然会继续跟踪它。

## 十、常见问题

### 1. 推送时报 authentication failed

如果看到类似错误：

```text
Invalid username or token. Password authentication is not supported for Git operations.
```

说明 GitHub 不支持直接用账号密码推送，需要使用 GitHub 登录授权或 Personal Access Token。

如果安装了 GitHub CLI，可以执行：

```bash
gh auth login
gh auth setup-git
```

然后再试：

```bash
git push origin main
```

### 2. push 被拒绝

如果推送时提示远程有更新，通常先执行：

```bash
git pull origin main
```

如果没有冲突，再执行：

```bash
git push origin main
```

### 3. 出现冲突怎么办

如果多人改了同一个文件的同一部分，可能会出现冲突。

冲突文件里一般会出现：

```text
<<<<<<< HEAD
本地代码
=======
远程代码
>>>>>>> ...
```

处理方式：

1. 打开冲突文件。
2. 保留正确内容。
3. 删除 `<<<<<<<`、`=======`、`>>>>>>>` 这些标记。
4. 重新提交：

```bash
git add .
git commit -m "解决代码冲突"
git push origin main
```

## 十一、推荐协作方式

如果项目人少，可以先直接在 `main` 分支协作：

```bash
git pull origin main
git add .
git commit -m "修改说明"
git push origin main
```

如果项目后面多人同时开发，建议每个人新建自己的功能分支：

```bash
git switch -c feature/功能名称
```

提交并推送分支：

```bash
git add .
git commit -m "完成某某功能"
git push -u origin feature/功能名称
```

然后在 GitHub 上创建 Pull Request，由负责人审核后再合并到 `main`。

## 十二、不要随便使用的命令

下面这些命令有风险，新手不要随便执行：

```bash
git push --force
git reset --hard
git clean -fd
```

含义：

- `git push --force`：强制覆盖远程分支，可能把别人代码覆盖掉。
- `git reset --hard`：强制回退本地代码，未保存修改会丢失。
- `git clean -fd`：删除未跟踪文件，可能误删本地资料。

不确定时，先执行：

```bash
git status
```

把输出发给项目负责人确认。

