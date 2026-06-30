# V1 部署与运维说明

## 目标形态

V1 正式环境建议采用：

- PC 平台端：H5 静态站点，路径 `/platform`
- 移动采集端：H5 静态站点，路径 `/mobile`
- 后端：FastAPI API 服务，路径 `/api`
- 数据库：PostgreSQL
- 文件存储：服务器挂载目录，后续可替换为 MinIO
- 反向代理：Nginx
- 后台任务：开发期同步执行，正式环境可启用 Redis + Celery

## 环境变量

后端至少配置：

```text
DATABASE_URL=postgresql+psycopg://user:password@127.0.0.1:5432/water_assessment
STORAGE_DIR=/data/water-assessment/storage
CELERY_TASK_ALWAYS_EAGER=false
SECRET_KEY=<生产密钥>
ACCESS_TOKEN_EXPIRE_MINUTES=720
```

生产环境不要提交真实密钥或数据库密码。

## Nginx 路由建议

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8000/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}

location /platform/ {
  alias /srv/water-assessment/front/;
  try_files $uri $uri/ /platform/index.html;
}

location /mobile/ {
  alias /srv/water-assessment/front-mobile/;
  try_files $uri $uri/ /mobile/index.html;
}
```

前端构建时设置：

```text
VITE_API_BASE_URL=/api
```

## 权限边界

- 普通用户：移动端采集、查看和重提退回记录。
- 管理员：数据复核、退回、锁定、报告生成、Agent 结果确认或弃用。
- 锁定记录不能被移动端或普通编辑接口修改。
- 已复核记录必须由管理员退回后才允许移动端重提。

## 备份

每天至少备份：

- PostgreSQL 数据库。
- `STORAGE_DIR` 下的附件、报告、资料包。
- 后端日志和报告任务错误日志。

恢复演练至少覆盖：

1. 数据库恢复。
2. 附件和报告文件恢复。
3. 历史报告下载可用。

## 运行检查

上线后基础检查：

```text
GET /api/health
GET /api/mobile/projects
GET /api/dashboard/towns
```

测试工程师复验：

```powershell
Agent\backend\.venv\Scripts\python.exe Agent\测试\test_project_pipeline.py
Agent\backend\.venv\Scripts\python.exe Agent\测试\check_report_quality.py
```

验收重点：

- 移动端提交后 PC 看板实时出现。
- 管理员能复核、退回、重提、锁定。
- 报告只能读取已复核或已锁定数据。
- 郁南和茂南分别生成对应项目报告结构。
- 报告中附件目录、Agent 已确认摘要、水质限值、表格序号均正确。
