# 供排水设施考核系统后端开发计划

## 1. 目标定位

本系统面向内部员工使用，核心目标是打通以下业务链路：

```text
移动端现场采集村级数据
-> PC端数据看板汇总
-> PC端数据预览与复核
-> 锁定考核数据
-> 自动生成绩效考核报告
-> 历史报告下载与追溯
```

当前已有两个前端工程：

- `front`：PC平台端，包含数据看板、资料上传、报告生成、历史报告等页面。
- `front-mobile`：移动端采集入口，用于录入镇街、村点、设施评分、管网评分、调查问卷、扣分说明和现场照片。

后端开发应优先服务这两个前端已经形成的产品流程，不另起一套孤立后台。

## 2. 推荐技术栈

V1阶段采用 Python 模块化单体后端：

- Web框架：FastAPI
- 数据校验：Pydantic
- ORM：SQLAlchemy
- 数据库迁移：Alembic
- 数据库：PostgreSQL
- 异步任务：Redis + Celery，原型期可先用 RQ
- 文件存储：本地目录起步，后续可替换为 MinIO
- 报告生成：python-docx、docxtpl、openpyxl，并复用现有报告生成脚本
- Agent/大模型：作为独立服务模块接入，不替代确定性评分和金额计算
- 部署：Docker Compose

暂不建议 V1 使用 Spring Boot 作为主后端。原因是当前产品的重心在结构化采集、文档生成、规则计算、Agent增强，这些更贴近 Python 生态。后期如果需要企业级平台治理，可在 API 边界稳定后再拆出 Java/Spring Boot 业务层。

## 3. 总体架构

```text
front-mobile
  -> FastAPI backend

front
  -> FastAPI backend

FastAPI backend
  -> PostgreSQL: 结构化考核数据、复核记录、任务记录
  -> File Storage: 照片、资料包、生成报告
  -> Redis: 异步任务队列和任务状态
  -> Worker: 报告生成、资料解析、报告校验
  -> Agent Module: 非标准资料理解、报告段落生成、语义校验
```

边界原则：

- 移动端不直接连接数据库，只通过后端 API 提交 JSON 和附件。
- 后端是评分、金额计算、状态流转和数据锁定的唯一可信来源。
- 大模型不直接决定金额和最终分数，只做辅助理解、归纳、润色和语义检查。
- 报告生成前必须经过 PC 端数据预览和复核。

## 4. 评分标准配置化原则

评分标准必须作为配置数据管理，不能写死在后端代码或前端页面里。

原因：

- 大部分项目评分标准相对稳定，但不同城市、不同考核周期、不同合同版本可能会微调。
- 后续可能新增、删除或调整一级指标、二级指标、三级指标、分值、扣分选项和适用设施类型。
- 历史考核数据必须绑定当时使用的评分标准版本，不能因为新标准发布而影响旧报告。

实现原则：

- 使用 `indicator_versions` 管理评分标准版本，例如 `台山市2023年下半年度版`、`某市2024年上半年度版`。
- 使用 `indicators` 存储指标树，支持一级、二级、三级指标，通过 `parent_id` 表达层级关系。
- 指标应包含编码、名称、层级、满分、排序、适用设施类型、扣分方式、是否启用、版本 ID 等字段。
- 三级指标下方的评价标准、扣分原因、扣分选项应单独配置，不能混在三级指标名称里。
- 使用 `deduction_options` 或同类表存储三级指标下的扣分项，例如扣分原因、扣分类型、固定分值、扣分范围、计量单位、次数上限、是否需要照片等。
- 移动端通过接口动态读取评分标准，例如 `GET /api/mobile/indicator-standards`，不长期硬编码指标清单。
- 评分记录使用 `indicator_id` 关联指标，不只保存指标名称文本。
- 评分记录还应记录命中的扣分项 ID，例如 `deduction_option_id`，用于后续复核、统计扣分原因和生成报告。
- 如果一个城市只是微调标准，应新增评分标准版本，不直接覆盖旧版本。
- 报告生成时必须使用考核记录绑定的评分标准版本。

开发约束：

- 不允许在接口代码里写死二级指标名称、三级指标名称、分值和扣分规则。
- 不允许把三级指标下的多个扣分项拼接成一段文本后存储，扣分项必须可单独选择、统计和追溯。
- 不允许为每个固定指标单独设计数据库列，例如 `sewage_collection_score`。
- 可以在前端保留临时 mock 指标数据，但接后端后必须以接口返回的指标树为准。
- 若确有复杂计算规则，应抽象为规则类型或规则配置，并保留版本号。

## 5. 后端目录建议

```text
Agent/backend/
  app/
    main.py
    api/
      auth.py
      mobile.py
      dashboard.py
      records.py
      reports.py
      uploads.py
    core/
      config.py
      database.py
      security.py
    models/
    schemas/
    repositories/
    services/
      assessment/
      dashboard/
      review/
      reporting/
      storage/
      agent/
    workers/
  alembic/
  tests/
  pyproject.toml
  docker-compose.yml
  README.md
```

开发时保持模块边界清晰，避免把上传、入库、评分、报告生成和 Agent 调用全部写在一个接口里。

## 6. 核心数据模型

第一批建议建设以下表：

- `users`：员工账号、角色、状态。
- `assessment_cycles`：考核批次，例如 `2023年下半年度`。
- `towns`：镇街基础信息。
- `villages`：村点基础信息。
- `facilities`：设施点，区分污水处理设施、管网设施等。
- `indicator_versions`：评分标准版本。
- `indicators`：一级、二级、三级指标和分值。
- `deduction_options`：三级指标下的评价标准和扣分项。
- `assessment_records`：一个村点在一个批次下的一次考核主记录。
- `assessment_scores`：指标级评分、扣分、说明、调整原因。
- `survey_records`：调查问卷评分。
- `inspection_issues`：现场问题项，可关联指标和照片。
- `attachments`：照片、资料包、报告等文件元数据。
- `review_logs`：PC端复核、修改、退回、锁定记录。
- `report_tasks`：报告生成任务。
- `reports`：最终报告文件记录。

存储原则：

- 分数、扣分、金额等字段使用 `NUMERIC`，不要使用浮点数。
- 核心评分数据关系化存储，便于统计、筛选和复核。
- 原始移动端提交 JSON 可作为审计快照存入 `JSONB` 字段。
- 图片和报告文件不直接存 PostgreSQL，只存文件路径、对象 key、hash、大小、上传人等元数据。

## 7. API 规划

### 6.1 移动端采集 API

```text
GET  /api/mobile/towns
GET  /api/mobile/towns/{town_id}/villages
GET  /api/mobile/indicator-standards
POST /api/mobile/assessment-records
PUT  /api/mobile/assessment-records/{id}/scores
POST /api/mobile/assessment-records/{id}/attachments
POST /api/mobile/assessment-records/{id}/submit
```

目标：让 `front-mobile` 从本地内存数据，升级为真实草稿保存、附件上传和村点提交。

### 6.2 PC 数据看板 API

```text
GET /api/dashboard/overview
GET /api/dashboard/towns
GET /api/dashboard/issues
GET /api/dashboard/deduction-ranking
```

目标：让 `front` 的数据看板从假数据，升级为读取 PostgreSQL 汇总结果。

### 6.3 数据预览与复核 API

```text
GET    /api/records
GET    /api/records/{id}
PUT    /api/records/{id}
DELETE /api/records/{id}
POST   /api/records/{id}/review
POST   /api/records/{id}/return
POST   /api/assessment-cycles/{id}/lock
```

目标：支持 PC 端对移动端数据进行查询、编辑、删除、复核、退回和锁定。

### 6.4 资料上传与报告生成 API

```text
POST /api/uploads
POST /api/report-tasks
GET  /api/report-tasks/{id}
GET  /api/reports
GET  /api/reports/{id}/download
```

目标：支持两种报告生成来源：

- 从资料包上传生成报告。
- 从已复核的数据看板数据生成报告。

## 8. 开发阶段计划

### 阶段一：后端骨架与数据库

目标：

- 创建 `Agent/backend` 后端工程。
- 初始化 FastAPI、SQLAlchemy、Alembic。
- 配置 PostgreSQL、Redis、文件存储目录。
- 提供 `/health` 接口。

验收：

- 后端可启动。
- `/health` 返回正常。
- Alembic 能创建第一批基础表。

### 阶段二：移动端数据入库

目标：

- 实现移动端镇街、村点、指标标准读取接口。
- 实现村点考核草稿保存、评分保存、照片上传、提交接口。
- 将 `front-mobile` 当前内存提交逻辑改为调用后端 API。

验收：

- 一个村点的设施评分、管网评分、调查问卷、照片都能保存。
- 页面刷新后能从后端恢复草稿或已提交数据。

### 阶段三：PC 数据看板

目标：

- 实现考核批次、镇街进度、完成率、扣分统计、异常清单接口。
- 将 `front` 数据看板从静态假数据切换为后端数据。

验收：

- PC 端能按批次查看各镇街采集进度。
- 能显示待复核、缺照片、低分、人工调整等异常数据。

### 阶段四：数据预览与复核

目标：

- 实现村点记录列表、详情、编辑、删除、复核、退回、锁定。
- 增加复核日志，记录修改人、修改时间、原值、新值和原因。

验收：

- PC 端能查看并修改移动端提交数据。
- 所有人工修改都有审计记录。
- 数据锁定后不能被移动端或普通编辑接口修改。

### 阶段五：报告生成任务

目标：

- 接入现有 Python 报告生成逻辑。
- 实现异步报告生成任务。
- 支持任务进度查询、报告下载、历史报告列表。

验收：

- PC 端可基于已复核数据创建报告任务。
- 后端能生成 DOCX 报告并保存文件记录。
- 前端能查看进度并下载报告。

### 阶段六：Agent/大模型增强

目标：

- 将 Agent 模块作为增强能力接入。
- 优先用于非标准资料解析、问题描述归纳、报告段落生成、报告语义校验。
- 保留确定性评分、金额计算和格式校验作为主链路。

验收：

- Agent 输出必须结构化，并带来源依据。
- 分数和金额不由大模型直接决定。
- Agent 失败时，系统仍能通过确定性流程生成基础报告。

## 9. 当前开发优先级

建议按以下顺序推进：

1. 建 `Agent/backend` 后端骨架。
2. 定义移动端提交 JSON 和数据库模型。
3. 先打通一个村点的完整提交链路。
4. 再做 PC 端数据看板真实接口。
5. 再做数据预览和复核。
6. 最后接报告生成和 Agent 增强。

不要一开始就追求完整平台化、复杂权限、多租户、微服务或大模型全流程自动化。V1 的成功标准是：移动端采集的数据能可信入库，PC 端能复核，后端能基于复核数据生成正式报告。
