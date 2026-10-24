# AI Factory 机房建设 / 集群交付 · 全栈复刻

把两份低代码静态原型（机房建设、集群交付）复刻成一个可用的全栈应用：视觉与交互 1:1，数据真正落库。

- 前端：React 19 + TypeScript + Vite + React Router
- 后端：Node 24 + Fastify 5 + 内置 `node:sqlite`
- 测试：Vitest（领域 + API）、Playwright（端到端 / 截图）
- 样式：原型 5 个 CSS 文件原样复用，字体自托管，不依赖任何外网资源

## 快速开始

```bash
npm install
npm run dev        # API :9000 + Vite :5173
open http://127.0.0.1:5173/room-buildout
```

生产：

```bash
npm run build
npm start          # 单进程，同时提供 /api 与静态资源，默认 :9000
```

```bash
HOST=100.x.y.z PORT=8891 npm start   # 只监听 Tailscale 接口
```

## 数据

- SQLite 文件默认 `data/app.db`（`DB_PATH` 可覆盖），首次启动自动灌 seed。
- seed 在 `shared/seed.ts`：20 个机房、30 个集群、9 个批次，日期围绕 2026-10 编排，确定性生成。
- 重置：`npm run db:reset`（删除并重建数据，会清空所有手工改动）。
- 所有写操作通过 API 落库，并写 `audit_log`；操作人来自顶栏头像，请求头 `X-Operator`。

## 两个页面

| 路由 | 说明 |
| --- | --- |
| `/room-buildout` | 机房建设：KPI、过去/现在/未来卡片、建设时间线、机房清单、机房详情抽屉、登记机房 |
| `/cluster-delivery` | 集群交付：KPI、供给时间线、集群清单、集群抽屉（六环节 + 子项）、登记集群、导出 CSV |

筛选、阶段 tab、搜索同步到 URL，可直接分享。机房与集群的关系是 1—N；"过去/现在/未来"和"当前阶段"都由阶段状态与日期推导，数据库不存 `phase`。

## 目录

```
shared/        领域类型、六阶段定义、环境项模板、派生逻辑、seed、单元测试
server/        Fastify 应用、SQLite schema 与读写、API 测试、seed CLI
web/           React 应用（页面、抽屉、Modal、UI 基础组件）
web/public/fonts  Inter / Noto Sans SC / Material Symbols 自托管字体
docs/          原型逆向盘点（prototype-inventory.md）、状态截图、ADR
.scratch/      本地 issue tracker：spec 与 tickets
```

## 测试

```bash
npm test                  # Vitest：领域推导 + API 集成
npx playwright test       # （如已安装）端到端
```

领域逻辑的单一真源在 `shared/domain.ts`，前后端共用；改推导规则先改这里与测试。

## 术语

见 `GLOSSARY.md`。关键约定：

- **阶段状态**是唯一真源（todo / doing / done / skip），当前阶段 = 第一个未完成且不适用的阶段。
- **机房日期**从阶段子项读取：`ko-plan`（启动）、`deploy-estimate`（目标）、`acceptance`（验收）。
- **计划集群数**手填，可与已录入集群数不等，不一致时并列展示。
- 环境项不阻塞阶段推进；阶段允许跳步与回退，每次改动记操作日志。

## 与原型的差异（有意为之）

- 去掉了 `Prototype`、`示例数据`、`mock` 徽章、演示横幅、"仅保存在本浏览器"等演示痕迹。
- 两个页面共用一套机房 / 集群数据；原型里两套数据没有共同 id。
- 时间用真实当天，不再固定 2026-10-18；因此分组数量与耗时天数会与原型截图不同。
- 顶栏去掉了 Copilot、通知与场景切换；搜索框变成可用的全站搜索。
- 集群交付页没有"批次 / 集群"视图切换（原型的活页面也没有），批次只作为数据层分组。
- 补上了原型没做的写能力：阶段推进、子项勾选、集群编辑 / 删除、机房编辑 / 删除、CSV 导出、操作日志。

## 设计文档

- 复刻规格：`.scratch/ai-factory-clone/spec.md`
- 原型逆向盘点（字段、交互、缺陷、截图索引）：`docs/prototype-inventory.md`
- 截图基线：`docs/screenshots/`
