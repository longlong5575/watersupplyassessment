# 排水绩效考核后端

这是 `Agent` 交付目录中的后端，配合：

- `Agent/frontend/front` 平台端
- `Agent/frontend/front-mobile` 移动端

## 收件人运行方式

回到 `Agent` 文件夹，双击：

```text
点我启动.vbs
```

脚本会静默准备后端、两个前端和运行目录，然后打开：

- 平台端：默认 http://127.0.0.1:5173
- 移动端：默认 http://127.0.0.1:5174
- 后端接口：默认 http://127.0.0.1:8000

如果默认端口被占用，启动脚本会自动换到可用端口，并把当前地址写入 `排水\运行脚本\watersupply-agent-runtime\logs\startup-status.json`。

运行生成物统一放在：

```text
排水\运行脚本\watersupply-agent-runtime
```

## 测试工程师复验

在 `watersupplyassessment` 目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\Agent\测试\run_agent_checks.ps1
```

复验会覆盖：

- 后端语法编译
- 移动端提交到平台端看板
- 复核、锁定、生成 DOCX 报告
- 报告内容质量检查
- 平台端和移动端类型检查、正式构建

测试结果会写到：

```text
排水\运行脚本\watersupply-agent-runtime\test-results
```

## 目录原则

`Agent` 只放源码、锁文件、说明和启动入口；虚拟环境、前端依赖、日志、数据库、上传附件和生成报告都属于运行生成物，不放进交付源码目录。
