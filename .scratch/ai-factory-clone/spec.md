# AI Factory 机房建设 / 集群交付 · 全栈复刻

Status: implemented
Tracker: `.scratch/ai-factory-clone/`
Integration branch: `feat/ai-factory-clone`

## Problem Statement

团队手上只有一份低代码导出的静态原型：两个页面（机房建设、集群交付）视觉与交互已经设计好，但所有数据写死在 JS 里，唯一的写操作存进浏览器 localStorage。刷新会丢、换人看不到、两个页面各用一套互相矛盾的数据。我们要把这两个页面变成真正可用的东西——打开就能看、点得动、改完别人也能看到——同时保持和原型一样的视觉与交互密度。

这是一次复刻实验，不是生产系统：目标是验证这套静态设计能被还原到什么程度，因此允许在数据层面重建、允许自行决定工程细节，但不允许在视觉与交互上走样。

## Solution

一个单进程全栈应用：Fastify 提供 JSON API 与静态资源，SQLite 落库，React + Vite 前端按原型的 DOM 结构与 class 原样重建两个页面。原型的 5 个 CSS 文件（design-system、tailwind 子集、room-buildout、hierarchy、cluster-delivery）一字不改地复用，字体自托管，保证换一台机器也长得一样。

两个页面共用一套领域模型：机房是集群的唯一归属，机房有建设六阶段，集群有交付六阶段，两条轨道独立推进。"过去 / 现在 / 未来"和"当前阶段"不再存字段，一律由阶段状态与日期推导。

所有原型里能点的东西都变成真的：登记机房、逐阶段改状态、填阶段子项、轮转环境项、登记集群、推进集群交付环节、按筛选导出 CSV。原型里的 `Prototype`、`示例数据`、`mock` 徽章、"仅保存在本浏览器"等演示痕迹全部去掉。

## User Stories

1. 作为 SRE，我打开应用默认进入机房建设页，看到与原型一致的统计卡、阶段卡、时间线和机房清单。
2. 作为 SRE，我能在机房建设页按区域（中国 / 非中）、集群类型、业务方筛选，列表、统计卡与时间线同时收敛。
3. 作为 SRE，我能在搜索框输入机房名、VDC、负责人或集群名，列表按匹配结果过滤，无结果时看到空态而不是空白。
4. 作为 SRE，我能一键重置所有筛选与搜索。
5. 作为 SRE，我能在"过去 / 现在 / 未来 / 全部"之间切换，每个 tab 显示对应数量，切 tab 时 URL 可分享。
6. 作为 SRE，我能按关键日期、机房名称、负责人排序机房清单，并能恢复默认排序。
7. 作为 SRE，我在时间线上看到每个机房的启动 → 完成区间，只有目标日期的显示为菱形里程碑。
8. 作为 SRE，我能展开完整时间线，看到每段全部机房（默认每段最多预览 2 个）。
9. 作为 SRE，时间线上有"今天"参考线，跨年时月份刻度连续不间断。
10. 作为 SRE，我点击机房行或机房名打开右侧抽屉，抽屉内是机房概览、机房内集群、六阶段 SOP 三个区域。
11. 作为 SRE，我在机房概览里看到区域、VDC、业务线、负责人、计划集群数、启动 / 完成日期、耗时、集群交付进度。
12. 作为 SRE，我在阶段区看到六个阶段的状态（待处理 / 进行中 / 已完成 / 不适用）与当前阶段，并知道当前阶段是怎么算出来的。
13. 作为 SRE，我点击某个阶段把它展开，看到该阶段的说明与子项表单（日期、负责人、文本、勾选）。
14. 作为 SRE，我修改阶段子项后立即落库，刷新或换浏览器仍是新值。
15. 作为 SRE，我能在阶段区把阶段标为进行中 / 已完成 / 不适用，机房当前阶段与清单上的进度随之更新。
16. 作为 SRE，我在"机房部署"阶段看到 13 个环境项方块，点击方块按待处理 → 进行中 → 已完成 → 不适用循环。
17. 作为 SRE，我能为机房新增自定义环境项（名称 + 分类），也能删除自定义项。
18. 作为 SRE，我在机房详情里登记新集群（名称、类型、业务方、负责人、VDC、开始 / 目标日期），登记后集群出现在该机房下与集群交付页。
19. 作为 SRE，我能删除登记错的集群，或修改集群的负责人、日期、阻塞说明。
20. 作为 SRE，我能从机房详情跳转到该机房在集群交付页的批次或集群。
21. 作为 SRE，我点击"登记机房建设需求"打开表单，填写项目名、区域、业务方、关键时间、五个 PoC 后创建机房。
22. 作为 SRE，创建机房时若名称为空或重名，我看到行内错误而不是静默失败。
23. 作为 SRE，新建的机房出现在清单、时间线与统计卡里，状态为"规划中"（未填启动日期）或按日期推导。
24. 作为 SRE，我能编辑或删除已登记的机房，删除前有确认。
25. 作为 SRE，我进入集群交付页，看到按批次分组的供给时间线：机房为行、批次为条带。
26. 作为 SRE，我在集群交付页切换"批次 / 集群"两种视图，批次看供给节奏，集群看单点卡在哪。
27. 作为 SRE，我在集群视图里看到每个集群的六环节圆点、阻塞原因、负责人、耗时 / SLA、瓶颈与下一步。
28. 作为 SRE，我按区域、机房、类型、状态筛选集群，时间线与表格一起收敛。
29. 作为 SRE，我点击集群行进详情，查看六阶段逐项清单并勾选子项。
30. 作为 SRE，我推进集群交付阶段，阶段完成后集群状态自动从"建设中"变成"已交付"。
31. 作为 SRE，我能记录/清除集群的阻塞说明与风险标签，列表与详情同步。
32. 作为 SRE，我能按当前筛选导出集群 CSV，Excel 打开中文不乱码。
33. 作为 SRE，我在任意写操作后看到明确反馈（成功 toast 或错误提示），按钮在请求期间禁用。
34. 作为 SRE，我重启服务后所有数据还在。
35. 作为 SRE，我能看到某个机房 / 集群最近谁改了什么（操作日志）。
36. 作为新同事，我打开应用就知道当前操作人是谁，并能改成一个自己的名字。
37. 作为新同事，我不需要登录、不需要配置，打开 URL 就能用。
38. 作为设计验收者，我把复刻页与原原型并排截图，版式、间距、颜色、字号无可见差异。
39. 作为设计验收者，我看到原型里的演示标记（Prototype / 示例数据 / mock）已全部移除。
40. 作为维护者，我在 API 或领域逻辑改坏时，运行一次测试就能发现。

## Implementation Decisions

### 技术栈与运行形态

- Node 24 + TypeScript，Fastify 5，SQLite 用内置 `node:sqlite`（`DatabaseSync`），无原生编译依赖。
- 前端 React 19 + Vite + React Router，TypeScript；测试 Vitest；端到端 Playwright。
- 单进程：生产模式 Fastify 同时托管 `web/dist` 静态资源与 `/api/*`，只暴露一个端口。
- 开发模式 Vite 代理 `/api` 到 Fastify。
- 不使用 Tailwind 构建：原型的 `tailwind.css` 是 55 行手写工具类子集，原样复用。
- 字体自托管：Inter、Noto Sans SC、Material Symbols 的 woff2 与 @font-face CSS 放进静态资源，不依赖任何第三方字体 CDN。

### 视觉复刻契约

- 5 个 CSS 文件复制进项目，**不修改**。新增样式只允许出现在"原型没有的状态"（loading、toast、确认框、错误提示）里，并使用同一套 CSS 变量。
- React 组件输出的 DOM 结构与 class 名必须与原型一致；时间线、进度条等动态几何仍以 inline style 的 `left/width %` 实现，计算公式照搬。
- 图标继续用 Material Symbols 连字（`<span class="mat">hub</span>`）。
- 侧栏只保留"交付与准入"一个分组，含"集群交付""机房建设"两项；其余导航、mock 徽章、演示横幅、"参考与口径"入口全部移除。
- 顶栏保留品牌与操作人，去掉 Copilot、通知、场景切换；搜索框变成真实的全站搜索（机房 / 集群），命中后跳转并高亮。
- 页面标题、描述、区块标题与说明文案沿用原型。

### 领域模型

术语以 `GLOSSARY.md` 为准。核心实体：

- **机房 Room**：`id, name(unique), area(cn|overseas), region, vdc, line(训练|推理|微服务|混合), tenants[], owner, planCount|null, note, stages[6], envItems[], createdAt, updatedAt`。
- **机房阶段 BuildoutStage**：`index(0..5), status(todo|doing|done|skip), fields{ itemId: string }`。阶段定义（名称、说明、子项、控件类型）是代码常量，不入库。
- **环境项 EnvItem**：`key, name, category, status(pending|doing|done|skip), custom`。全局 13 项模板，机房从模板实例化；允许增删自定义项。
- **集群 Cluster**：`id, roomId, batchId|null, name, group, type, tenant, owner, vdc, startDate, planEndDate, deliveredDate?, slaDays|null, delivery[6], blocker, next, risk{level,short,text}|null, origin`。
- **交付阶段 DeliveryStage**：`index(0..5), status, checks{ subKey: boolean }`。
- **批次 Batch**：`id, roomId, type, startDate, endDate, planCount, owner, origin`。批次是计划单位，`planCount` 可大于已录入集群数。
- **操作日志 AuditLog**：`id, at, operator, entity(room|cluster|env|batch), entityId, action, detail(JSON)`。

推导规则（不落库）：

```
currentStage(room) = 第一个 status ∉ {done, skip} 的下标，全完成则为 6
roomPhase(room)    = currentStage===6 ? past
                   : currentStage===0 && (startDate===null || startDate>today) ? future
                   : present
roomStatus(room)   = past ? delivered : future ? planned : blocker ? blocked : building
clusterPhase(c)    = 交付六阶段全 done/skip ? past : 未开始且 startDate>today ? future : present
clusterStatus(c)   = past ? delivered : future ? planned : blocker ? blocked : building
roomStartDate      = stages[0].fields['ko-plan']
roomTargetDate     = stages[0].fields['deploy-estimate']
roomDeliveredDate  = stages[5].fields['acceptance']
```

- 机房阶段推进：允许任意阶段改任意状态（含回退），不强制顺序、不强制阻塞；每次修改写操作日志。把阶段 6 置为 done 且验收日期为空时，自动把当天写入 `acceptance`。
- 环境项不阻塞阶段推进，只做统计与展示。
- 集群交付阶段完成后不自动改机房阶段；当机房未"完成"但已有集群进入交付时，机房详情与集群交付页显示黄色风险提示。
- "过去 / 现在 / 未来"全部推导，数据库不存 `phase`。
- 计划集群数：`planCount` 手填，与已录入集群数并列展示，不一致时提示"计划 N，已录入 M"。

### API 契约

所有写操作要求 `X-Operator` 请求头（缺省记为"未署名"），返回最新实体。错误统一为 `{ error: { code, message } }`，状态码 400/404/409/500。

```
GET    /api/bootstrap                  → { today, stages: {room[], cluster[]}, envTemplates[], options{areas,lines,types,tenants,owners}, operator }
GET    /api/rooms?area&type&tenant&query&phase → RoomSummary[]
GET    /api/rooms/:id                  → RoomDetail（含 clusters、audit 最近 20 条）
POST   /api/rooms                      → RoomDetail（name 唯一，409 重名）
PATCH  /api/rooms/:id                  → RoomDetail
DELETE /api/rooms/:id                  → { ok: true }（级联删集群）
PUT    /api/rooms/:id/stages/:index    → RoomDetail  { status }
PATCH  /api/rooms/:id/stages/:index/fields → RoomDetail  { itemId, value }
PUT    /api/rooms/:id/env/:key         → RoomDetail  { status }
POST   /api/rooms/:id/env              → RoomDetail  { name, category }
DELETE /api/rooms/:id/env/:key         → RoomDetail
POST   /api/rooms/:id/clusters         → RoomDetail  { name, type, tenant, owner, vdc, startDate, planEndDate, group, batchId }
GET    /api/clusters?area&roomId&type&tenant&status → ClusterSummary[]
GET    /api/clusters/:id               → ClusterDetail（含 room 摘要、audit）
PATCH  /api/clusters/:id               → ClusterDetail
DELETE /api/clusters/:id               → { ok: true }
PUT    /api/clusters/:id/delivery/:index → ClusterDetail { status }
PATCH  /api/clusters/:id/delivery/:index/checks → ClusterDetail { key, value }
GET    /api/batches?area&roomId&type   → BatchSummary[]（含 members、派生进度与风险）
POST   /api/batches                    → BatchSummary
PATCH  /api/batches/:id                → BatchSummary
GET    /api/export/clusters.csv?area&roomId&type&tenant&status → text/csv (UTF-8 BOM)
GET    /api/audit?entity&entityId      → AuditLog[]
```

`RoomSummary` 额外带 `summary: { recorded, planned, delivered, blocked, building, plannedClusters, pct, narrowed }`；`ClusterSummary` 额外带 `phase, status, stageIndex, duration {sla, actual, over}, roomName`。

### Seed

`shared/seed.ts` 以确定性函数生成，不使用随机：

- 20 个机房：8 个过去（已交付）、5 个现在（在建）、7 个未来（规划）；覆盖中国 12 / 非中 8，四种业务线，负责人取原型里出现过的人名。
- 8 个批次，覆盖 6 个机房（wlby、syd2a、hhdh、my1a、seed-hk、wuhan）。
- 30 个集群：交付六阶段进度分布为已完成 12 / 在建 15 / 规划 3，其中 3 个带阻塞、2 个带风险。
- 每个机房实例化 13 个环境项，状态按机房进度分布；每个机房的前两个阶段子项填写日期与 PoC。
- 日期围绕 2026-10 编排，保证在真实"今天"下三种阶段都有内容；跨到 2027 以覆盖跨年时间线。

### 前端结构

- 路由：`/room-buildout`（默认）、`/cluster-delivery`；筛选、tab、搜索同步到 URL query，可直接分享。
- 状态：页面级筛选用 URL；数据请求用轻量 `useApi` hook（loading / error / refetch），不引入状态库。
- 所有写操作走同一层 `api` 客户端；成功后刷新受影响的查询，失败弹 toast。
- 抽屉与 Modal 用原生 `<dialog>` 或 portal，焦点管理与 Esc 关闭照原型。
- 空态、加载态、错误态是新增视觉，必须使用既有 CSS 变量与 `chip`/`btn` 类。

### 已知原型缺陷（复刻时不保留）

- `setStage` 与 `setStageStatus` 双写入口冲突 → 只保留阶段状态。
- `phase` 字段与日期/阶段可互相矛盾 → 全推导。
- README 写"三阶段 SOP"、页面写"六阶段" → 以六阶段为准，文案统一。
- 两页数据集互相不认识 → 统一到同一套机房 / 集群。
- 集群交付页完全只读 → 补上阶段推进与子项勾选。
- 统计卡"17 个机房计划总数待确认"是硬编码感很强的示例值 → 由真实 `planCount` 空值数计算。

## Testing Decisions

好的测试只断言外部可观察行为：HTTP 响应、页面可见文本与落库结果；不断言组件内部 state、不 mock 实现细节。

- **领域单元测试**（Vitest，`shared`）：当前阶段推导、阶段/状态推导（含边界：全 skip、无日期、跨年）、耗时与 SLA 计算、时间线月份与条带定位、计划 vs 已录入。
- **API 集成测试**（Vitest + `fastify.inject` + 临时 SQLite 文件）：每个写路由的成功路径与关键失败路径（重名 409、不存在 404、非法状态 400）、派生字段是否正确、删除级联、CSV 表头与 BOM、操作日志落库。
- **端到端**（Playwright）：① 打开机房建设页看到 KPI 与清单；② 筛选 + 搜索 + 切 tab；③ 打开机房抽屉、改阶段状态、刷新后仍在；④ 登记机房 → 出现在清单；⑤ 集群交付页切视图、推进阶段、导出 CSV。
- **视觉验收**：1600px 宽截图与原型的对应状态并排比对；差异只看版式、间距、颜色、字号，不看数据内容。原型的截图基线在本地保留，不随公开仓库发布。

## Out of Scope

- 登录、SSO、权限与角色；操作人只是一个名字字符串。
- 原型侧栏里其余 20 多个 mock 页面（主机、故障、基线等）。
- 接入飞书 / Lark / 妙搭真实数据源，或写回任何生产系统。
- 通知、Copilot、告警、审批流。
- 移动端适配与暗色主题（原型只有桌面浅色）。
- 集群交付页原型未提供的集群详情抽屉之外的新页面。
- 生产级部署（HTTPS、备份策略、监控）；只做本机单实例。

## Further Notes

- 现有原型仍在 `http://100.105.144.118:8890/index.html` 运行，重构期间保留它作为视觉对照。
- 原型的自动清点文档在本地保留（不随公开仓库发布），是事实来源。
- 验收时用真实"今天"（2026-10-24 起）而非原型写死的 2026-10-18；因此分组数量、耗时天数与原型截图必然不同，这是预期。
- 若某个原型交互在清点文档中不存在，不要发明；先按现有截图与代码实现。
