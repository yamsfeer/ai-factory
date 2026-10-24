# AI Factory 机房建设 / 集群交付

[![ci](https://github.com/yamsfeer/ai-factory/actions/workflows/ci.yml/badge.svg)](https://github.com/yamsfeer/ai-factory/actions/workflows/ci.yml)

把一份低代码导出的静态原型（机房建设、集群交付两个页面）复刻成可用的全栈应用：视觉与交互按原型 1:1 还原，数据从写死的 JS 搬进 SQLite，所有原型里能点的操作都真正落库。

适合用来参考：如何把一个只有视觉稿/静态原型的产品，快速变成可运行的前后端应用；以及如何用 Playwright + ProofShot 给一次重构留下可回放的验收证据。

## 功能

| 页面 | 能力 |
| --- | --- |
| `/room-buildout` 机房建设 | 4 个 KPI、过去/现在/未来阶段卡、建设时间线（今日线、里程碑、展开）、区域/类型/业务/搜索/阶段/排序筛选（同步 URL）、机房清单与六阶段进度 |
| 机房详情 | 概览、机房内集群、六阶段侧拉面板（四态、日期/负责人/文本/勾选子项、阶段负责人/计划/完成/备注）、13 个环境项方块 + 自定义增删、集群登记/编辑/删除、机房编辑/删除、风险提示 |
| `/cluster-delivery` 集群交付 | 三态 KPI、供给时间线（一集群一条带、交付来源分段、今日线、展开）、9 列集群清单、集群抽屉（六环节子项勾选、环节推进、编辑/删除）、登记集群、按筛选导出 CSV |
| 全局 | 无登录、可切换操作人、操作日志、全站搜索、所有修改持久化 |

## 技术栈

- 前端：React 19、TypeScript、Vite 8、React Router
- 后端：Node 24、Fastify 5、`node:sqlite`（无原生依赖）
- 测试：Vitest（领域 + API 集成）、Playwright（端到端）、ProofShot（录屏验收）
- 样式：原型 CSS 原样复用，字体（Inter / Noto Sans SC / Material Symbols）自托管，运行时不依赖任何外网资源

## 快速开始

要求 **Node.js ≥ 22.5**（`node:sqlite` 需要；推荐 24）与 npm。

```bash
git clone <this-repo> ai-factory
cd ai-factory
npm install
npm run dev
```

- Web：<http://127.0.0.1:5173/room-buildout>
- API：<http://127.0.0.1:9000/api/health>
- Vite 已把 `/api` 代理到后端，前端只写相对路径。

首次启动会自动建库并灌入 seed（20 个机房 / 29 个集群 / 9 个批次），数据文件是 `data/app.db`。

## 生产运行

```bash
npm run build
npm start                 # 单进程：API + dist/web 静态资源，默认 :9000
```

只监听内网地址（例如 Tailscale）：

```bash
HOST=100.x.y.z PORT=8891 npm start
```

或者用脚本（构建 + 重启 + 健康检查，PID 写到 `data/server.pid`）：

```bash
HOST=100.x.y.z PORT=8891 ./scripts/serve-prod.sh
./scripts/stop-prod.sh
```

## 数据与配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `9000` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址，不要用 `0.0.0.0` 暴露公网 |
| `DB_PATH` | `data/app.db` | SQLite 文件路径 |
| `SEED_ON_START` | 开 | 设为 `0` 可关闭启动时自动灌 seed |

- 重置数据：`npm run db:reset`（删除并重建，会清空手工改动）。
- 操作人：顶栏头像里改，存在浏览器 `localStorage`，随写请求以 `X-Operator` 发送并记入 `audit_log`。
- seed 是确定性生成的，定义在 `shared/seed.ts`，日期围绕 2026-10 编排。

## 测试

```bash
npm test                     # Vitest：领域推导 + API 集成（40 项）
npm run typecheck            # tsc --noEmit
API_URL=http://127.0.0.1:5173 node scripts/e2e.mjs http://127.0.0.1:5173
                             # Playwright 端到端：20 步，跑完自动复原数据
```

端到端覆盖两个页面的筛选、抽屉、六阶段、环境项、机房/集群增删改、CSV、操作人。默认使用 Playwright 缓存里的 Chromium；不在默认路径时用 `CHROMIUM_PATH` 指定。

用 ProofShot 录一段可回放的验收视频（可选）：

```bash
APP_URL=http://127.0.0.1:5173 bash scripts/proofshot-demo.sh
# 产物：/tmp/ai-factory-proof/proofshot-artifacts/<时间>/viewer.html
```

## 目录结构

```
shared/          领域类型、六阶段定义、环境项模板、派生逻辑、seed、单元测试
server/src/      Fastify 应用、SQLite schema 与读写、API 测试、seed CLI
web/src/         React 应用：页面、抽屉、Modal、API 客户端、UI 基础组件
web/src/styles/  原型 CSS（design-system / tailwind 子集 / 页面样式）
web/public/fonts 自托管字体
scripts/         e2e.mjs、proofshot-demo.sh、serve-prod.sh、stop-prod.sh
docs/            DEVELOPMENT.md（开发指南）
.scratch/        本地 issue tracker：spec 与 tickets
```

## 领域模型

机房（Room）是集群（Cluster）的唯一归属，两条进度轨道独立：

- 机房建设六阶段：确认机房信息 → 预算提交 & 3V 创建 → 机房 KO → 机房部署 → 机房检查 → 完成
- 集群交付六环节：确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知

关键约定（详见 [GLOSSARY.md](GLOSSARY.md)）：

- **阶段状态是唯一真源**（todo / doing / done / skip），当前阶段 = 第一个未完成且不适用的阶段。
- **阶段（过去/现在/未来）不落库**，由阶段状态 + 日期推导。
- **机房日期来自阶段子项**：`ko-plan`（启动）、`deploy-estimate`（目标）、`acceptance`（验收）。
- 环境项不阻塞阶段推进；阶段允许跳步与回退，每次改动写操作日志。

## API 一览

所有写操作接受 `X-Operator`，返回最新实体；错误体统一为 `{ error: { code, message } }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/bootstrap` | 阶段定义、环境项模板、筛选项、今天 |
| GET/POST | `/api/rooms` | 列表（area/type/tenant/query/phase）、创建 |
| GET/PATCH/DELETE | `/api/rooms/:id` | 详情 / 更新 / 删除（级联集群） |
| PUT | `/api/rooms/:id/stages/:index` | 阶段状态 |
| PATCH | `/api/rooms/:id/stages/:index/fields` | 阶段子项 |
| PATCH | `/api/rooms/:id/stages/:index/meta` | 阶段负责人/计划/完成/备注 |
| PUT/POST/DELETE | `/api/rooms/:id/env...` | 环境项状态、自定义增删 |
| POST | `/api/rooms/:id/clusters` | 机房内登记集群 |
| GET | `/api/clusters` | 集群列表（area/roomId/type/status/origin/query） |
| GET/PATCH/DELETE | `/api/clusters/:id` | 集群详情 / 更新 / 删除 |
| PUT | `/api/clusters/:id/delivery/:index` | 交付环节推进 |
| PATCH | `/api/clusters/:id/delivery/:index/checks` | 子项勾选 |
| GET/POST/PATCH | `/api/batches` | 批次 |
| GET | `/api/export/clusters.csv` | 当前筛选导出 CSV（UTF-8 BOM） |
| GET | `/api/audit` | 操作日志 |

## 与原型的差异

- 去掉 `Prototype`、`示例数据`、`mock`、演示横幅、"仅保存在本浏览器"等演示痕迹。
- 两个页面共用一套机房 / 集群数据；原型里两套数据没有共同 id。
- 时间使用真实当天，不再固定 2026-10-18；分组数量与耗时天数会与原型截图不同。
- 顶栏只保留品牌、全站搜索与操作人；集群交付页没有"批次 / 集群"视图切换（原型活页面也没有）。
- 原型只读或只存内存的操作，这里补成了真写：阶段推进、子项勾选、集群/机房编辑删除、CSV 导出、操作日志。

## 文档

- [开发指南](docs/DEVELOPMENT.md)：从零跑起来、架构、数据表、派生规则、排障
- [术语表](GLOSSARY.md)
- [复刻规格](.scratch/ai-factory-clone/spec.md)
