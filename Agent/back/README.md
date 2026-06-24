# 排水绩效考核后端

这是可交付的 Agent 后端副本，包含 SQLAlchemy、Alembic、PostgreSQL、Redis、Celery、复核与报告任务模块。

## 给收件人

双击 `Agent/点我启动.vbs`。首次运行会自动安装 Python 3.12、Node.js 和项目依赖，随后静默启动系统并打开 PC 后台和移动端页面。

如果系统拦截 `.vbs`，再双击 `Agent/start.bat`。启动失败时查看 `Agent/startup.log`。

## 一键初始化

在 `Agent` 目录执行一次：

```powershell
powershell -ExecutionPolicy Bypass -File .\init-recipient.ps1
```

脚本会创建后端环境、安装全部依赖，并写入两个前端的本地接口配置。
电脑需已安装 Python 3 和 Node.js；即使未安装 pnpm，脚本也会自动下载并使用它。

## 首次运行

在 `Agent/back` 目录执行：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

接口文档：`http://127.0.0.1:8000/docs`  
健康检查：`http://127.0.0.1:8000/health`

需要无窗口启动时，运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\静默启动后端.ps1
```

## 前端连接

在 `Agent/front` 和 `Agent/front-mobile` 中安装依赖并启动开发服务。两端统一使用：

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

移动端提交后，PC 看板会轮询后端并同步显示。PC 端创建报告任务时，后端会调用项目内的正式 DOCX 报告脚本，报告生成后可由接口下载。

## 交付清单

交付时保留 `Agent/back`、`Agent/front`、`Agent/front-mobile`，以及项目根目录的 `资料收集`、`生成`、`可迁移版`。不要提交 `.venv`、`storage`、日志和 `*.egg-info`；这些文件已被 `.gitignore` 排除，收件人会在首次运行时自行生成。
