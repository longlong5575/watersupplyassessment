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

- `Agent/frontend/front`：PC平台端，包含数据看板、资料上传、报告生成、历史报告等页面。
- `Agent/frontend/front-mobile`：移动端采集入口，用于录入镇街、村点、设施评分、管网评分、调查问卷、扣分说明和现场照片。
- `Agent/backend`：FastAPI 后端。
- `Agent/tests`：联调、报告任务和报告质量验证脚本。

后端开发应优先服务这两个前端已经形成的产品流程，不另起一套孤立后台。

当前前端仍处于原型阶段：

- `front-mobile` 目前以本地状态保存采集过程，并可导出镇街 JSON 数据包。
- `front` 目前以 mock 数据展示看板、数据预览、报告生成进度和历史报告。
- 后端开发时应把这些本地状态逐步替换为 API 数据源，不能要求前端重做一套全新流程。

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

- 评分标准版本必须绑定城市、考核批次和适用设施类型，形成 `city -> assessment_cycle -> indicator_version` 的选择关系。
- 移动端进入采集流程时，应先确定城市、考核批次和评分标准版本，再加载镇街、村点和指标树。
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
- PC 管理员可以基于已有评分标准版本复制出新版本，再微调考核内容、指标分值、评价标准、扣分项和适用设施类型。
- 已经被考核批次使用、已经产生提交记录或已经生成报告的评分标准版本，应进入锁定状态，不允许直接修改；如需调整，应复制为新版本。
- 草稿状态的评分标准版本可以编辑，发布后才能被考核批次绑定和移动端读取。

开发约束：

- 不允许在接口代码里写死二级指标名称、三级指标名称、分值和扣分规则。
- 不允许把三级指标下的多个扣分项拼接成一段文本后存储，扣分项必须可单独选择、统计和追溯。
- 不允许为每个固定指标单独设计数据库列，例如 `sewage_collection_score`。
- 可以在前端保留临时 mock 指标数据，但接后端后必须以接口返回的指标树为准。
- 若确有复杂计算规则，应抽象为规则类型或规则配置，并保留版本号。

## 5. 前端数据接入约束

当前 `front-mobile` 的数据结构可以作为 V1 API 的输入参考，但不能直接等同于最终数据库表结构。

移动端提交时至少应包含：

- 城市、考核批次、镇街、村点、设施类型。
- 本次记录绑定的 `indicator_version_id`。
- 正式评分指标记录，包括三级指标 ID、扣分项 ID、扣分值、人工调整值、扣分说明、备注和照片。
- 调查问卷原始记录，包括问卷类别、被访对象、分值、备注和完成状态。
- 水质抽检记录，包括取样时间、排放标准、工艺类型、规模、TP 限值是否适用、CODCr/NH3-N/TP 实测值和限值、抽检结论、备注。
- 原始提交 JSON 快照，用于审计、排障和后续兼容前端字段变化。

PC 端接入时应区分两个层级：

- 数据看板：面向镇街/村点/设施的进度、完成率、扣分统计、问题清单和异常提醒。
- 数据预览与复核：面向单条村点考核记录，展示完整评分、问卷、水质、照片、人工修改和复核日志。

前端本地状态替换原则：

- `front-mobile` 的本地 `entries` 对应后端 `assessment_scores`。
- `front-mobile` 的问卷状态对应后端 `survey_records`。
- `front-mobile` 的水质抽检状态对应后端 `water_quality_records`。
- `front-mobile` 的照片对象对应后端 `attachments`，文件走上传接口，数据库只存元数据。
- `front` 的看板 mock 数据应替换为 dashboard API 汇总结果，不直接读取移动端导出的 JSON 文件。
- `front` 的报告生成进度应替换为 report task API 的异步任务状态。

## 6. 后端目录建议

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

Agent/frontend/
  front/
  front-mobile/

Agent/tests/
```

开发时保持模块边界清晰，避免把上传、入库、评分、报告生成和 Agent 调用全部写在一个接口里。

## 7. 核心数据模型

第一批建议建设以下表：

- `users`：员工账号、角色、状态，至少区分普通用户和管理员。
- `cities`：城市基础信息，用于绑定评分标准版本。
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
- `water_quality_records`：水质抽检记录。
- `score_source_mappings`：问卷、水质等来源数据与正式评分指标的回填关系。
- `inspection_issues`：现场问题项，可关联指标和照片。
- `attachments`：照片、资料包、报告等文件元数据；现场照片应支持绑定到具体扣分项或评分明细。
- `review_logs`：PC端复核、修改、退回、锁定记录。
- `report_tasks`：报告生成任务。
- `reports`：最终报告文件记录。

存储原则：

- 分数、扣分、金额等字段使用 `NUMERIC`，不要使用浮点数。
- 核心评分数据关系化存储，便于统计、筛选和复核。
- 原始移动端提交 JSON 可作为审计快照存入 `JSONB` 字段。
- 图片和报告文件不直接存 PostgreSQL，只存文件路径、对象 key、hash、大小、上传人等元数据。

## 8. 来源数据回填规则

调查问卷和水质抽检不是独立重复计分模块，而是正式三级指标的数据来源。

问卷回填原则：

- 移动端仍保留调查问卷录入入口。
- 问卷结果应保存到 `survey_records`，并通过规则回填到对应三级指标。
- 对于来源于问卷的三级指标，移动端评分详情页不开放人工填写，只显示“问卷已回填”或“等待问卷回填”。
- 回填后的指标分数仍应写入或可计算为 `assessment_scores`，以保证总分、报告和复核口径一致。
- PC 端复核时应能看到回填来源，例如问卷类别、被访对象、原始分值和加权公式。

当前需要支持的问卷回填项包括：

- 产出-项目运营-污水收集。
- 产出-项目运营-整体效果。
- 效果-满意度-实施机构满意度。
- 效果-满意度-镇街满意度。
- 效果-满意度-公众满意度。

水质抽检回填原则：

- 水质抽检结果保存到 `water_quality_records`。
- 水质是否扣分、扣多少分，应通过配置规则映射到正式三级指标，不在前端写死。
- 水质抽检至少记录取样时间、排放标准、工艺类型、规模、TP 限值是否适用、CODCr/NH3-N/TP 实测值和限值、抽检结论。
- 如果水质抽检只作为报告佐证、不直接扣分，也必须在 `score_source_mappings` 中明确其作用，避免报告生成时遗漏。

## 9. API 规划

### 9.1 移动端采集 API

```text
GET  /api/mobile/cities
GET  /api/mobile/assessment-cycles?city_id={city_id}
GET  /api/mobile/towns
GET  /api/mobile/towns/{town_id}/villages
GET  /api/mobile/indicator-standards?city_id={city_id}&cycle_id={cycle_id}&facility_type={facility_type}
POST /api/mobile/assessment-records
PUT  /api/mobile/assessment-records/{id}/scores
PUT  /api/mobile/assessment-records/{id}/surveys
PUT  /api/mobile/assessment-records/{id}/water-quality
POST /api/mobile/assessment-records/{id}/attachments
POST /api/mobile/assessment-records/{id}/submit
```

目标：让 `front-mobile` 从本地内存数据，升级为真实草稿保存、附件上传和村点提交。

### 9.2 PC 数据看板 API

```text
GET /api/dashboard/overview
GET /api/dashboard/towns
GET /api/dashboard/villages
GET /api/dashboard/issues
GET /api/dashboard/deduction-ranking
```

目标：让 `front` 的数据看板从假数据，升级为读取 PostgreSQL 汇总结果。

### 9.3 数据预览与复核 API

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

### 9.4 资料上传与报告生成 API

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

## 10. 开发阶段计划

### 阶段一：后端骨架与数据库

目标：

- 创建 `Agent/backend` 后端工程。
- 初始化 FastAPI、SQLAlchemy、Alembic。
- 配置 PostgreSQL、Redis、文件存储目录。
- 提供 `/health` 接口。
- 初始化城市、考核批次、评分标准版本三类基础表。

验收：

- 后端可启动。
- `/health` 返回正常。
- Alembic 能创建第一批基础表。
- 能通过种子数据创建一个城市、一个考核批次和一套评分标准版本。

### 阶段二：移动端数据入库

目标：

- 实现移动端城市、考核批次、镇街、村点、指标标准读取接口。
- 实现村点考核草稿保存、评分保存、问卷保存、水质抽检保存、照片上传、提交接口。
- 将 `front-mobile` 当前内存提交逻辑改为调用后端 API。

验收：

- 一个村点的设施评分、管网评分、调查问卷、水质抽检、照片都能保存。
- 页面刷新后能从后端恢复草稿或已提交数据。
- 问卷来源指标能自动回填，并进入总分计算。
- 水质抽检数据能按配置规则关联到正式评分指标或报告佐证项。

### 阶段三：PC 数据看板

目标：

- 实现考核批次、镇街进度、完成率、扣分统计、异常清单接口。
- 将 `front` 数据看板从静态假数据切换为后端数据。

验收：

- PC 端能按批次查看各镇街采集进度。
- PC 端能下钻查看镇街下的村点、设施类型、指标完成情况和扣分摘要。
- 能显示待复核、缺照片、低分、人工调整等异常数据。

### 阶段四：数据预览与复核

目标：

- 实现村点记录列表、详情、编辑、删除、复核、退回、锁定。
- 增加复核日志，记录修改人、修改时间、原值、新值和原因。

验收：

- PC 端能查看并修改移动端提交数据。
- 所有人工修改都有审计记录。
- 数据锁定后不能被移动端或普通编辑接口修改。
- 复核页能展示问卷、水质等来源数据与正式评分指标之间的回填关系。

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

## 11. 当前开发优先级

建议按以下顺序推进：

1. 建 `Agent/backend` 后端骨架。
2. 定义城市、考核批次、评分标准版本、移动端提交 JSON 和数据库模型。
3. 先打通一个村点的完整提交链路。
4. 再做 PC 端数据看板真实接口。
5. 再做数据预览和复核。
6. 最后接报告生成和 Agent 增强。

不要一开始就追求完整平台化、复杂权限、多租户、微服务或大模型全流程自动化。V1 的成功标准是：移动端采集的数据能可信入库，PC 端能复核，后端能基于复核数据生成正式报告。

## 12. 待确认事项

以下事项已经确认，应作为后续后端和前端接入的开发约束：

1. 城市选择作为移动端第一步固定保留。
2. 考核批次由 PC 端管理员统一创建，移动端只选择已有批次。
3. 水质抽检结果不影响三级指标扣分，只作为报告佐证和人工复核依据。
4. 移动端需要离线暂存能力；前端可本地保存草稿，联网后再同步后端。
5. 照片需要绑定到具体扣分项，后端附件表应支持关联 `deduction_option_id` 或评分明细项。
6. V1 需要员工账号登录，并预留普通用户和管理员两类常规权限能力。
