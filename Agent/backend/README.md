# 排水绩效考核后端

这是 Agent 交付副本中的后端，配合 `Agent/frontend/front` 和 `Agent/frontend/front-mobile` 使用。

## 收件人怎么运行

### Windows

回到 `Agent` 文件夹，双击：

```text
start.vbs
```

### macOS

在终端进入 `Agent` 文件夹，执行：

```bash
chmod +x ./start-mac.sh
./start-mac.sh
```

首次运行会自动准备后端环境、安装前端依赖、写入本地接口配置，然后静默启动：

- PC 后台：`http://127.0.0.1:5173`
- 移动端：`http://127.0.0.1:5174`
- 后端接口：`http://127.0.0.1:8000`

启动过程不弹出命令行黑框。启动失败时查看 `Agent/startup.log`。

## 测试工程师怎么复验

在 `Agent/tests` 里运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_agent_checks.ps1
```

报告任务单独复验：

```powershell
..\backend\.venv\Scripts\python.exe .\run_report_task_check.py
..\backend\.venv\Scripts\python.exe .\check_report_quality.py
```

复验结果保存在 `Agent/测试/结果`，正式验证报告为 `Agent/测试/Agent前后端联调测试验证报告.docx`。

## 已验证链路

- 移动端读取镇街、周期、标准并提交考核记录。
- PC 后台看板实时读取提交记录。
- 后台完成复核、锁定。
- 报告任务生成正式 DOCX。
- 郁南、茂南会分别生成对应项目结构的 DOCX 正文和汇总报告。
- 正式报告会检查附件目录、Agent 已确认摘要、水质限值、表格序号、异常英文状态和乱码。

## V1 生产化说明

从本地原型部署到内部员工可用环境时，参考 `Agent/DEPLOYMENT_V1.md`。正式环境建议使用 PostgreSQL、Nginx 统一路由、独立文件存储目录和定期备份；本地启动脚本只用于开发或交付演示。

本地运行产物 `.venv`、`node_modules`、`dist`、`storage` 和日志不属于交付源码，收件人首次运行时会自动生成。
