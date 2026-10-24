# 开发指南

面向第一次接触这个仓库的开发者：怎么跑起来、代码怎么分层、数据怎么流转、改一个功能要动哪里。

## 1. 环境要求

- Node.js ≥ 22.5（用到内置 `node:sqlite`；推荐 24，仓库带 `.nvmrc`）
- npm 10+
- 可选：Playwright 的 Chromium（跑端到端时需要）。脚本默认使用 `~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`，不一致时用 `CHROMIUM_PATH` 指定。

```bash
nvm use            # 或手动切到 Node 24
npm install
```

## 2. 从零启动

```bash
npm run dev
```

`concurrently` 同时起两个进程：

- `tsx watch server/src/index.ts` → API，默认 <http://127.0.0.1:9000>
- `vite` → 前端，默认 <http://127.0.0.1:5173>，把 `/api` 代理到 9000

首次启动会创建 `data/app.db` 并灌 seed。想重新来一遍：

```bash
npm run db:reset
```

生产形态只有一个进程：

```bash
npm run build          # 产物 dist/web
npm start              # Fastify 同时提供 /api 和静态资源，默认 :9000
```

## 3. 架构

```
web/ (React)
  └─ fetch /api/* ──────────────┐
                                │
server/ (Fastify)               │
  ├─ 路由 + zod 校验            │
  ├─ db.ts：SQLite 读写         │
  └─ 派生字段由 shared/domain   │
                                │
shared/ (前后端共用)  ◄─────────┘
  ├─ types.ts    实体与 API 视图类型
  ├─ stages.ts   六阶段定义、环境项模板（产品知识，不入库）
  ├─ domain.ts   当前阶段/阶段/状态/耗时/时间线推导
  └─ seed.ts     确定性 seed
```

- 请求进来 → 路由校验 → `db.ts` 读实体 → `shared/domain.ts` 计算派生视图 → 返回 JSON。
- 前端用 `web/src/lib/api.ts` 统一发请求，`useApi` 管理 loading/error/reload；写操作成功后用响应更新局部状态并 `reload`。
- 前端没有状态库，页面筛选条件放 URL，刷新可分享。

## 4. 数据库

SQLite 单文件，schema 在 `server/src/db.ts` 的 `SCHEMA` 常量里，启动时 `CREATE TABLE IF NOT EXISTS`，并对 `room_stages.meta` 做了一次 `PRAGMA table_info` 保护的 `ALTER TABLE`。

| 表 | 作用 |
| --- | --- |
| `rooms` | 机房主表（名称唯一、区域、region、VDC、业务线、tenants JSON、负责人、计划集群数、阻塞、备注） |
| `room_stages` | 每机房 6 行：`status` + `fields`(JSON) + `meta`(JSON) |
| `room_env_items` | 每机房 13 个模板环境项 + 自定义项，四态 |
| `clusters` | 集群主表（归属机房、批次、类型、业务方、负责人、起止日期、SLA、阻塞、风险 JSON） |
| `delivery_stages` | 每集群 6 行：`status` + `checks`(JSON) |
| `batches` | 计划批次（机房、类型、起止、计划数、负责人） |
| `audit_log` | 操作日志（时间、操作人、实体、动作、detail JSON） |

删除机房会级联删除阶段、环境项、集群、交付环节（外键 `ON DELETE CASCADE` + `PRAGMA foreign_keys=ON`）。

## 5. 派生规则（重点）

这些字段**不落库**，前后端都从 `shared/domain.ts` 计算：

```
currentStage(room) = 第一个 status ∉ {done, skip} 的下标；全完成 = 6
roomPhase(room)    = currentStage === 6            → past
                   : currentStage === 0 且未启动且启动日期在未来/为空 → future
                   : present
roomStatus(room)   = past → delivered
                   : blocker → blocked
                   : future → planned
                   : building
roomStartDate      = stages[0].fields['ko-plan']
roomTargetDate     = stages[0].fields['deploy-estimate']
roomDeliveredDate  = currentStage === 6 ? stages[5].fields['acceptance'] : null
```

集群同理：交付六环节全部 done/skip → 已交付；第一个环节进行中 → 在建；未开始且启动日在未来 → 规划。

改这些规则时：先改 `shared/domain.ts`，同步改 `shared/domain.test.ts`，再检查前端所有用到 `phase/status/currentStage` 的地方。

## 6. 常见改动

**加一个阶段子项**

1. 在 `shared/stages.ts` 对应阶段的 `items` 里加 `{ id, label, type, desc }`。
2. 前端 `RoomStagePanel` 会按 `type`（date/person/text/check/env）自动渲染，无需改组件。
3. 若这个子项要参与派生（像 `ko-plan` 那样），在 `shared/domain.ts` 读取它。

**加一个环境项模板**

改 `shared/stages.ts` 的 `ENV_TEMPLATES`。新机房会实例化；已有机房不会自动补，需要写一次性迁移或重置 seed。

**改 seed**

改 `shared/seed.ts`，然后 `npm run db:reset`。seed 是确定性的（无随机数），同一天任何机器生成一致。

**加一个 API**

1. 在 `server/src/app.ts` 加路由，用 zod 校验入参。
2. 写操作调用 `writeAudit(...)`。
3. 在 `web/src/lib/api.ts` 加客户端方法。
4. 在 `server/src/api.test.ts` 加成功路径 + 关键失败路径（400/404/409）。

## 7. 测试策略

- **单元/领域**（`shared/*.test.ts`）：阶段推导、状态边界、耗时、时间线几何。纯函数，不碰数据库。
- **API 集成**（`server/src/api.test.ts`）：`buildApp({ dbPath: ':memory:' })` + `app.inject()`，覆盖写路径、派生字段、级联删除、CSV BOM、操作日志、重名/非法日期等错误分支。
- **端到端**（`scripts/e2e.mjs`）：真实浏览器跑两个页面的主流程 + 写路径，结束后删除测试数据并断言 20 机房 / 29 集群复原。失败时会打印当前 URL、行数、页面文本并截图到 `/tmp/e2e-fail.png`。

```bash
npm test
API_URL=http://127.0.0.1:5173 node scripts/e2e.mjs http://127.0.0.1:5173
```

## 8. 部署

```bash
HOST=<内网 IP> PORT=8891 ./scripts/serve-prod.sh
```

- 脚本会先 `npm run build`，再 `nohup node --import tsx server/src/index.ts` 起进程，PID 写 `data/server.pid`，日志追加到 `data/server.log`。
- 只监听 `HOST` 指定的地址；不要把 `HOST` 设成 `0.0.0.0`。
- 备份：直接复制 `data/app.db`（WAL 模式下同时复制 `-wal`/`-shm` 或先停服务）。
- 停止：`./scripts/stop-prod.sh`。

## 9. 排障

| 现象 | 排查 |
| --- | --- |
| 启动报 `Cannot find module 'node:sqlite'` | Node 版本过低，切到 22.5+ |
| 页面 404 / 刷新后 404 | 生产模式需要先 `npm run build`，Fastify 才能托管 `dist/web` |
| 字体变成系统默认 | `web/public/fonts` 是否随构建复制；`web/src/styles/fonts.css` 是否存在 |
| E2E 报找不到 Chromium | 设 `CHROMIUM_PATH`，或 `npx playwright install chromium` |
| 改了 seed 但页面没变 | seed 只在空库时灌；`npm run db:reset` |
| 端口被占 | `PORT=9001 npm start`，同时改 `vite.config.ts` 的 proxy 目标 |
| 数据库被锁 | 确认没有第二个进程同时写同一个 `DB_PATH` |

## 10. 录屏验收（可选）

```bash
APP_URL=http://127.0.0.1:5173 bash scripts/proofshot-demo.sh
```

需要本机已安装 [ProofShot](https://github.com/AmElmo/proofshot) 与 `agent-browser`。产物包含 `session.webm`、`viewer.html`（带时间轴与截图）、`SUMMARY.md`。
