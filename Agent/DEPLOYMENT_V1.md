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
## 首次建库与升级

启动正式后端前，必须先在 `Agent/backend` 目录执行：

```powershell
python -m alembic upgrade head
```

全新数据库和已有数据库都使用同一条命令；迁移成功后再启动 API。生产环境不会在启动时自动改表，避免绕过迁移记录或出现重复字段。

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

location /admin-account/ {
  alias /srv/water-assessment/admin-account/;
  try_files $uri $uri/ /admin-account/index.html;
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
powershell -ExecutionPolicy Bypass -File .\Agent\测试\run_agent_checks.ps1
```

测试结果保存在 `排水\运行脚本\watersupply-agent-runtime\test-results`。

验收重点：

- 移动端提交后 PC 看板实时出现。
- 管理员能复核、退回、重提、锁定。
- 报告只能读取已复核或已锁定数据。
- 郁南和茂南分别生成对应项目报告结构。
- 报告中附件目录、Agent 已确认摘要、水质限值、表格序号均正确。
## 账号与密码

- 账号数据保存于数据库 `users` 表，密码仅保存为不可逆哈希，不能从系统中查看原始密码。
- 首次生产部署前，将 `.env.production.example` 复制为服务器私有 `.env`，填写 `SECRET_KEY`、初始管理员密码、初始采集员密码、PostgreSQL 连接和正式域名。
- 初始密码只用于首次创建默认账号；账号已创建后，修改 `.env` 不会覆盖既有密码。
- 管理员使用独立的 `管理员账号管理.vbs` 入口新增、重置、启用或停用账号。新增和重置密码均由系统生成随机 8 位字母数字组合，并只展示一次。
- 平台端左下角用户名区域仅用于当前用户修改自己的密码；移动端、平台端和管理员入口共用同一套账号。
