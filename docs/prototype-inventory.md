# AI Factory「机房与集群建设」原型 · 逆向盘点（Rebuild Inventory）

> 盘点对象：`/home/yams/ai-factory/site/`（只读，未做任何修改）
> 原始压缩包：`AI Factory 机房与集群建设 v4.1 test.zip`（只读，内容与 site/ 一致）
> 运行地址：`http://100.105.144.118:8890/index.html`（机房建设）、`?view=cluster-delivery`（集群交付）
> 盘点时间：2026-10-24；快照日（原型自称）：机房页 `asOf 2026-10-18`，集群交付页 `asOf 2026-10-21`
> 截图：`docs/screenshots/`（43 张，1600px 宽视口，标注 full page 的为整页截图）
> 代码规模：30 个文件（16 个 JS 含 1 个测试、6 个 CSS、1 个 HTML、7 个配置/资产）；`design-system.css` 单文件 312 KB / 4,315 行

**这份文档只做事实盘点，不提出方案。** 所有结论均可在标注的 `文件:行` 或截图中复核。凡代码里没有的功能，文中会明确写“不存在”。

**摘要（先看这 12 条）**

1. 两个页面 = 两套独立数据集、两套阶段定义、两套 asOf（2026-10-18 / 2026-10-21）、两套持久化语义；只共享外壳与设计系统。
2. 机房页：20 机房 / 20 集群 / 计划总数 17（仅 3 个机房有值）/ 已交付 12 / 阻塞 3 / 进行中（无阻塞）2；三态 8·5·7。
3. 集群交付页：6 站点 / 20 批次 / 8 显式集群 + 22 条合成 = 30 个集群；三态 10·8·12；平均 35 天。
4. ID 交集：机房 id 5 个、集群 id **0 个**、站点独有 `hl`、机房独有 15 个 —— 两页无法按 id 关联。
5. 三态判定完全按存储的阶段/状态，不按日期；真实“今天”只会改变耗时/今日线/表单默认值（详见 §4.5）。
6. 写路径 15 条：机房页写 localStorage 两把 key；集群交付页**全部只写内存**，刷新即丢。
7. 最严重 bug：把任一后置阶段标“已完成”，会把机房 `stage` 归零、机房跳到“未来”（§7-D1）。
8. 数字不自洽：已交付 KPI 12 vs 过去卡 7；阻塞 3 vs “2 个集群正在建设”（实际 5 个在建）；20/20/17 三个数字并排（§7-D7/D8/D9）。
9. 文档矛盾：README 写“三阶段”，实现是六阶段，参考与口径仍写“3 环节完成数”；README 的 `npm test` 不存在（§7-D5/D6）。
10. 视觉：`design-system.css` 312 KB / 4,315 行、1,291 个类，本原型只用到约 150 个；`tailwind.css` 是 37 条手写工具类子集；图标靠外网 Material Symbols 连字，无降级。
11. 死代码：`cluster-delivery-view-v1.js/.css` 整份未加载（旧版才有“批次抽屉”）；`Store.setClusterStage/removeCluster` 无调用方；约 60 个 CSS 类无引用。
12. 重建首要裁决：阶段进度语义、演示数据是否可编辑、两套数据是否合并、SLA 口径、批次与集群的关系（§7 P0/P1）。

目录

1. [文件与模块地图](#1-文件与模块地图)
2. [数据实体与字段](#2-数据实体与字段)
3. [交互清单](#3-交互清单)
4. [时间与派生逻辑](#4-时间与派生逻辑)
5. [视觉资产](#5-视觉资产)
6. [状态截图](#6-状态截图)
7. [缺陷与不一致](#7-缺陷与不一致)
8. [重建所需的后端能力清单](#8-重建所需的后端能力清单)
9. [附录：复核方式](#9-附录复核方式)

---

## 1. 文件与模块地图

### 1.1 文件清单

`index.html` 是唯一入口（`routes.json` 只登记 `/` → `index.html`），无构建、无打包、无 npm 依赖（`package.json` 只有 `name/version/private/type`，`package-lock.json` 为空壳）。所有脚本以全局变量通信，没有 `import/export`（唯一例外是测试文件 `cluster-model.test.mjs`）。

| 文件 | 规模 | 是否被 index.html 加载 | 职责 | 暴露的全局 / 关键函数 |
|---|---|---|---|---|
| `index.html` | 89 行 / 5,143 B | — | 页面外壳：顶栏、侧栏容器、`#main`、字体与 5 个 CSS、14 个脚本的加载顺序、内联 SVG favicon | — |
| `data.js` | 63 行 / 17,623 B | ✅ L74 | 机房数据集（20 机房 / 20 集群 / 9 来源 / SLA / asOf） | `window.ROOM_BUILDOUT_DATA`（L2） |
| `buildout-store.js` | 81 行 / 4,589 B | ✅ L75 | 唯一持久化层：机房需求登记 + 机房内集群登记，写 `localStorage` | `globalThis.BUILDOUT_STORE`（L80） |
| `ui-kit.js` | 133 行 / 5,651 B | ✅ L76 | 基础 UI 原语：HTML 转义、空态/错误/加载态、图表调色板（ECharts 相关部分本项目未用） | 全局函数 `esc`（L8）、`emptyStateHTML`（L16）、`loadingHTML`、`buildChartPalette` |
| `compute-nav-icons.js` | 29 行 / 3,487 B | ✅ L77 | 侧栏图标：25 个内联 SVG path（不走图标字体） | `COMPUTE_NAV_ICON_PATHS`、`computeNavIcon()`（L26） |
| `compute-ui-kit.js` | 974 行 / 46,850 B | ✅ L78 | 生产版通用页壳组件库：页头/面包屑/数据徽标/KPI/页面说明抽屉/筛选/多选/Tab/表格/审计面板 | `computePageShell`（L41）、`computeSection`（L87）、`computeKpiStrip`（L101）、`computeKpiCard`（L105）、`computeDataBadge`（L26）等 |
| `cluster-model.js` | 110 行 / 7,576 B | ✅ L79 | 纯函数领域模型：阶段/阶段状态/阶段进度、机房与集群形态、筛选、汇总、时长、时间线几何 | `globalThis.ROOM_CLUSTER_MODEL`（L109） |
| `sop-data.js` | 65 行 / 7,070 B | ✅ L80 | SOP 转录：机房 6 阶段 + 20 子项、集群 6 阶段 + 子项、13 个环境项、登记表单采集字段 | `window.BUILDOUT_SOP`（L4） |
| `buildout-actions.js` | 105 行 / 5,220 B | ✅ L81 | 机房页写操作层：阶段状态、阶段元信息、字段、环境项循环、新增环境项、登记集群、删除登记；抛 `room-buildout-changed` 事件 | `globalThis.BUILDOUT_ACTIONS`（L104） |
| `navigation.js` | 78 行 / 3,603 B | ✅ L82 | 侧栏导航数据与渲染（加载即执行 `mountSidebar()`），并禁用非本原型的入口 | 无导出（IIFE） |
| `hierarchy-view.js` | 86 行 / 12,523 B | ✅ L83 | 机房页视图：三态卡片、时间线、机房清单行、阶段轨 | `window.BUILDOUT_VIEW`（L85） |
| `detail-view.js` | 194 行 / 27,411 B | ✅ L84 | 机房侧拉抽屉：机房概览、集群详情、登记集群表单、二级阶段登记面板、参考与口径 | `window.BUILDOUT_DETAILS = {open,close,sources}`（L193） |
| `cluster-delivery-data.js` | 241 行 / 12,004 B | ✅ L85 | 集群交付数据集（6 机房 / 20 批次 / 8 集群 / 6 阶段定义） | `window.CLUSTER_DELIVERY_DATA`（L2） |
| `cluster-delivery-view.js` | 1,007 行 / 60,263 B | ✅ L86 | 集群交付页整页实现：自己的 `esc`、自己的状态、自己的聚合/合成集群、时间线、清单、抽屉、子项编辑器、登记表单、CSV 导出、Toast | `window.mountClusterDelivery`（L1006） |
| `app.js` | 71 行 / 11,601 B | ✅ L87 | 极简路由（按 `?view`）+ 机房页装配与事件绑定；集群交付页只调用 `mountClusterDelivery()` 后 `return`（L2-3） | 无导出（IIFE） |
| `package.json` | 6 行 / 100 B | ❌ | `name/version/private/type`，**无 scripts**（`npm test` 不存在） | — |
| `package-lock.json` | 10 行 / 207 B | ❌ | 空依赖锁文件 | — |
| `design-system.css` | 4,315 行 / 312,333 B | ✅ L14 | 生产版设计系统：54 个根 token、暗色主题、组件类（按钮/chip/抽屉/筛选/页壳/KPI/表格/图表…） | — |
| `tailwind.css` | 42 行 / 1,577 B | ✅ L15 | **手写的 Tailwind 工具类子集**（37 条规则），仅供外壳使用，不是 Tailwind 构建产物 | — |
| `room-buildout.css` | 550 行 / 43,554 B | ✅ L16 | 机房页组件样式（阶段卡、阶段轨、环境项、登记弹窗、二级面板、旧版看板/表格残留） | — |
| `hierarchy.css` | 146 行 / 11,728 B | ✅ L17 | 机房/集群层级组件：筛选条、三态卡、时间线、机房行、抽屉宽度覆盖 | — |
| `cluster-delivery.css` | 317 行 / 28,725 B | ✅ L18 | 集群交付页整页视觉层（125 个 `cd-*` 类） | — |
| `cluster-delivery-view-v1.js` | 700 行 / 42,037 B | ❌ **未加载** | 集群交付页的旧版本（按机房分泳道 + 批次抽屉 + 阶段看板 + 仅导出批次），会覆盖同名全局 `window.mountClusterDelivery` | — |
| `cluster-delivery-v1.css` | 305 行 / 25,217 B | ❌ **未加载** | 旧版集群交付样式（117 个 `cd-*` 类，与现行版部分同名不同义） | — |
| `cluster-model.test.mjs` | 68 行 / 4,432 B | ❌ 仅 node:test | 8 个模型单测，全部通过 | — |
| `thumbnail.png` | 160,611 B | ❌ 页面未引用 | 原型缩略图，仅作品集/预览用 | — |
| `README.md` | 19 行 | ❌ | 说明文档（含与实现冲突的“三阶段”“npm test”，见 §7） | — |
| `routes.json` | 3 行 | ❌ | 静态路由声明（`/` → `index.html`） | — |
| `.spark/meta.json` | 4 行 | ❌ | 宿主平台元信息（`stack: design-html`, `archType: 0`） | — |
| `.gitignore` | 32 行 | ❌ | 忽略 node_modules/dist/编辑器文件 | — |

### 1.2 加载顺序与依赖方向

`index.html` 的加载顺序是硬编码的，且**预加载了只有第二页才用到的资源**（L7-9 `preload` cluster-delivery 的 css/data/view，即使当前是机房页）。

```
<link>  design-system.css → tailwind.css → room-buildout.css → hierarchy.css → cluster-delivery.css
<script>
  1 data.js                  → window.ROOM_BUILDOUT_DATA
  2 buildout-store.js        → BUILDOUT_STORE
  3 ui-kit.js                → esc, emptyStateHTML, …
  4 compute-nav-icons.js     → computeNavIcon
  5 compute-ui-kit.js        → computePageShell / computeSection / computeKpiStrip / computeDataBadge
  6 cluster-model.js         → ROOM_CLUSTER_MODEL
  7 sop-data.js              → BUILDOUT_SOP
  8 buildout-actions.js      → BUILDOUT_ACTIONS（依赖 1/2/6）
  9 navigation.js            → 立即执行 mountSidebar()（依赖 3/4 与 #compute-sidebar-nav）
 10 hierarchy-view.js        → BUILDOUT_VIEW（依赖 1/3/6/7）
 11 detail-view.js           → BUILDOUT_DETAILS（依赖 1/2/3/6/7/8）
 12 cluster-delivery-data.js → CLUSTER_DELIVERY_DATA
 13 cluster-delivery-view.js → mountClusterDelivery（依赖 3 的 emptyStateHTML、5 的 computePageShell）
 14 app.js                   → 判断 ?view：cluster-delivery → mountClusterDelivery() 后 return；
                               否则装配机房页（依赖全部上述）
```

依赖方向（谁读谁）：

- **数据 → 模型 → 动作 → 视图 → 装配**：`data.js` / `cluster-delivery-data.js` 不依赖任何文件；`cluster-model.js` 只依赖 `data.js` 的类型约定；`buildout-actions.js` 同时读 `data.js`、`buildout-store.js`、`cluster-model.js`；`hierarchy-view.js` / `detail-view.js` 只读模型与 SOP；`app.js` 只做装配。
- **`sop-data.js` 是“流程定义”的唯一来源**，`detail-view.js` 与 `hierarchy-view.js` 都从 `SOP.room` / `SOP.cluster` 取阶段名与子项名，因此阶段数与阶段名改一处即可全页生效。
- **两套 `esc`**：`ui-kit.js` 定义全局 `esc`（L8）；`cluster-delivery-view.js` 在自己的 IIFE 内**重新定义**了 `esc`（L17），页内所有转义走本地版本，与全局版行为一致但与 `ui-kit.js` 无调用关系。
- **两套“阶段”定义并存**：`cluster-model.js:3` 的 `STAGES`（“资源准备+机器重装/BKE创建/…”无空格）只用于机房页的集群详情文字；`cluster-delivery-data.js:6-62` 的 `stages`（“资源准备 + 机器重装/BKE 创建/…”带空格）用于集群交付页。两者是同一套语义的两份文案，**没有共享常量**。
- **集群交付页与机房页共享的只有外壳**：`computePageShell`、`computeSection`、`emptyStateHTML`、侧栏与顶栏；数据、模型、持久化、抽屉全部独立。

### 1.3 全局符号契约

| 全局 | 生产者 | 消费者 | 备注 |
|---|---|---|---|
| `window.ROOM_BUILDOUT_DATA` | `data.js:2` | `app.js`、`buildout-actions.js`、`hierarchy-view.js`、`detail-view.js` | 20 机房对象**是可变单例**：演示数据编辑直接改这些对象 |
| `globalThis.BUILDOUT_STORE` | `buildout-store.js:80` | `buildout-actions.js:3` | `list/rooms/add/remove/update/has/clusters/addCluster/removeCluster/setClusterStage/hasCluster`；其中 `removeCluster`、`setClusterStage`、`hasCluster` **无任何调用方** |
| `esc` | `ui-kit.js:8` | `navigation.js`、`hierarchy-view.js`、`detail-view.js`、`compute-ui-kit.js` | 全局函数（非 window 显式挂载，靠脚本顶层 `function` 声明） |
| `emptyStateHTML` | `ui-kit.js:16` | `cluster-delivery-view.js:307,366` | 集群交付页的两个空态 |
| `computePageShell` / `computeSection` / `computeKpiStrip` | `compute-ui-kit.js:41/87/101` | `app.js:49`、`cluster-delivery-view.js:973` | 页壳、区块、KPI 条 |
| `globalThis.ROOM_CLUSTER_MODEL` | `cluster-model.js:109` | `app.js`、`buildout-actions.js`、`hierarchy-view.js`、`detail-view.js` | 纯函数，无 DOM |
| `window.BUILDOUT_SOP` | `sop-data.js:4` | `app.js`（`requestItemIds`）、`hierarchy-view.js`、`detail-view.js` | 机房 6 阶段 / 集群 6 阶段 / 13 环境项 / 9 登记字段 |
| `globalThis.BUILDOUT_ACTIONS` | `buildout-actions.js:104` | `detail-view.js:3`、`app.js:4` | 写操作；内部派发 `room-buildout-changed` |
| `window.BUILDOUT_VIEW` | `hierarchy-view.js:85` | `app.js` | `phaseCards/timeline/hierarchy/…` |
| `window.BUILDOUT_DETAILS` | `detail-view.js:193` | `app.js:57` | `open/close/sources` |
| `window.CLUSTER_DELIVERY_DATA` | `cluster-delivery-data.js:2` | `cluster-delivery-view.js:2` | 同样被就地修改（`D.clusters.push`，L809） |
| `window.mountClusterDelivery` | `cluster-delivery-view.js:1006` | `app.js:3` | 旧版 `cluster-delivery-view-v1.js:699` 定义了**同名**函数；一旦被加载会静默互相覆盖 |

### 1.4 两页分流方式

```js
// app.js:2-3
const params = new URLSearchParams(location.search);
if (params.get('view') === 'cluster-delivery' && typeof window.mountClusterDelivery === 'function') {
  window.mountClusterDelivery(); return;
}
```

- `?view=cluster-delivery` → 集群交付页；**任何其他值（含 `?view=room-buildout`、无参数）→ 机房建设页**。
- 机房页还读 `?phase=`（`app.js:5`，合法值 `all|past|present|future`，否则默认 `present`），并在切换阶段/重置时用 `history.replaceState` 写回 URL（`app.js:9`）。**筛选、搜索、排序不进 URL**。
- 集群交付页**不写也不读任何 URL 参数**（`cluster-delivery-view.js:13` 的 state 全内存）。
- 集群交付页不会执行 `app.js:49-71` 的机房页代码，因此机房页那套“禁用顶栏”的逻辑在第二页由 `navigation.js:74-77` 独立完成；两页最终禁用集合相同。

### 1.5 未参与运行的文件（重建时需明确取舍）

1. `cluster-delivery-view-v1.js` + `cluster-delivery-v1.css`：旧版整页实现，**没有被任何 HTML 引用**，但它是唯一的“批次（batch）抽屉”实现（`openBatch`，v1:543；`batchDrawer`，v1:512）。现行版本已删除批次抽屉，改为“条带即集群”。
2. `thumbnail.png`、`README.md`、`routes.json`、`.spark/meta.json`、`.gitignore`：非运行时资产。
3. `compute-ui-kit.js` 中约 900 行（Tab、多选筛选、表格块、分页、审计面板、Insight）在本原型两页中**没有任何调用**；实际用到的只有 `computePageShell/computeSection/computeKpiStrip/computeKpiCard/computeDataBadge` 与页面说明抽屉。
4. `ui-kit.js` 的图表调色板、加载态状态机同样未被调用。

---

## 2. 数据实体与字段

两个页面使用**两个完全独立的数据集**，文件、asOf、粒度、ID 体系都不同；它们之间没有外键，也没有共享模块。下面分别穷举，再在 §2.12 对照。

### 2.1 两个数据集总表

| 维度 | 机房建设页 | 集群交付页 |
|---|---|---|
| 文件 | `data.js`（`ROOM_BUILDOUT_DATA`） | `cluster-delivery-data.js`（`CLUSTER_DELIVERY_DATA`） |
| asOf / 基准日 | **2026-10-18**（`data.js:59`） | **2026-10-21**（`cluster-delivery-data.js:3`） |
| 其他日期元信息 | `referenceSnapshotDate: 2026-10-12`、`sourceReadAt: 2026-10-18`（`data.js:61-62`） | `rangeStart: 2026-01-01`、`rangeEnd: 2028-01-01`（L4-5） |
| 一级实体 | 机房 Room（20 条） | 机房 Site（6 条）+ 交付批次 Batch（20 条）+ 集群 Cluster（8 条显式 + 22 条合成） |
| 阶段定义 | `sop-data.js`：机房 6 阶段 20 子项、集群 6 阶段 16 子项、13 环境项 | `cluster-delivery-data.js:6-62`：6 阶段、16 子项、baseline 天 |
| 持久化 | 用户登记写 localStorage（两个 key） | **无持久化**，全部内存 |
| 页面渲染入口 | `app.js` | `cluster-delivery-view.js` |

### 2.2 Room（机房）字段 — `data.js:4-23`，共 20 条

| 字段 | 类型 | 20 条中的情况 | 含义 / 取值 | 主要使用处 |
|---|---|---|---|---|
| `id` | string | 20/20，唯一 | 机房标识，如 `yx`、`wlby`、`seed-fi` | 列表 key、抽屉入参、集群 `roomId` |
| `name` | string | 20/20 | 展示名（含“机房/专区/云基地”等不同后缀） | 列表、时间线、抽屉标题 |
| `vdc` | string \| null | 5 非空（`yx/id4a/wlby/syd2a/kmmh`），15 null | VDC 标识；null 显示“待确认” | `hierarchy-view.js:44`、`detail-view.js:46` |
| `area` | `'cn' \| 'overseas'` | 12 / 8 | 区域大类，中文渲染“中国 / 非中” | 区域筛选、详情、KPI 明细 |
| `region` | string | 20/20，10 种取值 | 细区域：`China-North3/North/North6/North5/Central/Southwest/Northwest`、`NonTT`、`Australia-SouthEastBD`、`火山华北5AZC` | 行副标题、详情 facts、搜索 |
| `line` | string | 20/20 | 建设方向：训练 8 / 混合 4 / 微服务 4 / 推理 4 | 行副标题、详情；**模型支持 `filters.line` 但 UI 无此筛选** |
| `tenants` | string[] | 20/20，1–2 个 | 业务方：Seed 10、Flow 6、TCE 3、AML 2、财经支付 1、Stone 1、Engine 1 | 业务筛选下拉、详情 |
| `poc` | string | 20/20 | 机房负责人（含“井诚 / 韩亮”这种双人字符串） | 列表、时间线、排序 |
| `phase` | `'past'\|'present'\|'future'` | 8 / 5 / 7 | **仅作数据标注，页面判定不使用它**（见 §4.2） | 无直接引用 |
| `ko` | ISO date \| null | 19 有值，`kmmh` 为 null | 预计启动/KickOff | 时间线起点、已推进天数 |
| `target` | ISO date \| null | 19 有值，`kmmh` 为 null | 计划完成 | 时间线终点、列表“预计完成” |
| `delivered` | ISO date \| null | 8 有值，12 null | 实际交付 | 过去态列表/时间线、耗时 |
| `planCount` | number \| null | 3 有值（`yx 7`、`wlby 6`、`syd2a 4`），17 null | 计划集群总数；“null = 计划总数待确认” | 进度“已交付 / 计划”、`unplannedRooms` |
| `source` | string \| null | 20/20 有值，5 种（`yx`/`wlby`/`syd2a`/`fy26`/`weekly`） | 指向 `sources[]` 的资料 id | 详情“机房参考资料”链接 |
| `org` | string | 全部 `internal` | 归属；`selectRooms` 只保留 `internal` | 过滤（`cluster-model.js:69`） |
| `action` | string | 全部 `build` | 动作；只保留 `build` | 过滤（同上） |
| `stage` | 0–6 整数 | 分布 `0:7, 1:3, 2:1, 4:1, 6:8` | **已完成的机房阶段数**（6 = 全部完成） | 阶段轨、当前阶段、阶段相位 |
| `blocker` | string | 仅 `wlby` 非空 | 机房级阻塞文案 | 行状态徽标、抽屉“机房阻塞” |
| `demo` | true | 20/20 | 示例标记（页面未渲染该字段） | 无 |
| `envStatus` | `{[envItemId]: 'pending'\|'doing'\|'done'\|'skip'}` | 仅 2 条（`wlby`、`syd2a`，各 13 键） | 环境项状态；缺省 = pending | 环境项方块、计数 |
| `note` | string | 9 条 | 数据说明（“建设排期及集群规划为示例…”等） | 抽屉底部注释 |

**Room 的运行时附加字段**（不在 `data.js` 中，由代码写入）：

| 字段 | 写入者 | 说明 |
|---|---|---|
| `fields` | `buildout-actions.js:83-95` | 子项值：`{itemId: string}`（日期/负责人/文本/勾选 `'1'`） |
| `stageStatus` | `buildout-actions.js:14-28` | `{stageIndex: 'todo'\|'doing'\|'done'\|'skip'}`；缺省按 stage 推导 |
| `stageMeta` | `buildout-actions.js:31-46` | `{stageIndex: {owner, plan, done, note}}` |
| `customEnv` | `buildout-actions.js:48-55` | 自定义环境项数组 `{id,name,category,scenes[]}` |
| `userRequest` / `createdAt` | `buildout-store.js:22-35` | 需求登记机房标记与登记时间 |
| `summary` | `cluster-model.js:67-75`（`selectRooms`） | `{clusters,matched,total,planned,delivered,blocked,building,pending,future,pct,status,narrowed}`，**只存在于筛选结果对象上** |

### 2.3 Cluster（集群）字段 — `data.js:26-45`，共 20 条

| 字段 | 类型 | 20 条中的情况 | 含义 | 使用处 |
|---|---|---|---|---|
| `id` | string | 20/20，格式 `机房id/组名`（如 `wlby/Panda`） | 集群主键 | 行点击、抽屉 |
| `roomId` | string | 20/20，全部命中机房 | 父机房 | 聚合 |
| `name` | string | 20/20 | 展示名（`core-yx`、`Seed01（名称待确认）`、`规划训练集群（示例）`） | 列表/详情 |
| `group` | string \| null | 3 条 null（规划占位） | 集群组 | 详情“VDC / 集群组” |
| `type` | `'通用'\|'训练'\|'推理'\|'微服务'` | 5 / 6 / 5 / 4 | 集群类型 | 类型筛选、详情 |
| `tenant` | string | TCE 11、Seed 6、AML 2、Engine 1 | 业务方 | 业务筛选 |
| `stage` | 0–6 | `0:3, 2:1, 3:3, 4:1, 6:12` | 已完成的集群阶段数 | 阶段轨、状态派生 |
| `owner` | string | 7 条“待确认” | 集群负责人 | 详情 |
| `slaDays` | number \| null | 3 / 4 / null（3 条规划） | SLA 天数 | 详情“SLA（示例）” |
| `actualDays` | number \| null | 8 条 null | 实际累计耗时；null 时用 `start→delivered/asOf` 计算 | 详情“累计耗时”、模型 `clusterDuration` |
| `blocker` | string | 3 条非空（Panda/Visa/CloudNative） | 阻塞文案 | 状态 `blocked`、抽屉“当前阻塞” |
| `nameConfirmed` | boolean | 4 条 false | 名称是否确认（false 的名称含“待确认/示例”） | 未渲染，仅测试断言 |
| `start` | ISO date | 20/20 | 启动时间 | 详情、耗时 |
| `target` | ISO date | 20/20 | 目标交付 | 详情“预计交付” |
| `delivered` | ISO date \| null | 8 条 null | 实际交付 | 详情“实际交付” |
| `next` | string | 20/20 | 下一步文案 | 抽屉“下一步”（无阻塞时） |
| `phase` | `'past'\|'present'\|'future'` | 12 / 5 / 3 | 数据标注；状态实际由 `stage` 派生 | `clusterPhase` 回退参考 |
| `vdc` | string \| null | 3 条 null | VDC | 详情 |
| `demo` | true | 20/20 | 示例标记 | 未渲染 |
| `source` | string | 20/20 | 资料来源 id | 未单独渲染 |
| `identitySource` | `'reference'\|'demo'` | 17 / 3 | 名称来源（参考快照 / 示例占位） | 未渲染，仅测试 |

**Cluster 的运行时字段**（用户登记集群，`buildout-store.js:45-61`）：`id/roomId/name/vdc/group/type/tenant/owner/phase`（**恒为 `'future'`**）、`start/target/delivered:null/stage/blocker:''/next/demo/userRequest/createdAt`；**没有 `slaDays`、`actualDays`、`group` 默认 null、`nameConfirmed`**，因此详情显示“SLA（示例）—”“累计耗时 未启动”。

### 2.4 `sources` / `sla` / 元字段

`sources`（`data.js:47-57`）共 9 条，字段 `{id,title,url,revision}`（`cluster-sop` 额外有 `readAt:"2026-10-18"`）：

| id | 标题 | revision | 被谁引用 |
|---|---|---|---|
| `fy26` | FY26 机房建设项目列表 | 1482 | README、`meta` |
| `weekly` | 周报 O1 · 新机房建设进展 | 15450 | — |
| `sop` | 机房部署项目全流程 SOP | 1303 | 参考与口径列表 |
| `acceptance` | 组件交付及验收模板 | 467 | 参考与口径列表 |
| `template` | 方案与 KickOff 模板 | 442 | 参考与口径列表 |
| `yx` | YX 机房搭建 | 1842 | `yx` 机房详情 |
| `wlby` | WLBY 集群搭建 | 608 | `wlby` |
| `syd2a` | syd2a 机房搭建 | 688 | `syd2a` |
| `cluster-sop` | 集群管理设计 · 六阶段 SOP | 246（readAt 2026-10-18） | 集群详情链接 |

`sla`（`data.js:58`）：`{"bke":3,"room":21}` —— **全项目没有任何代码读取**（grep 无命中）。
`asOf`、`demo`、`referenceSnapshotDate`、`sourceReadAt`：见 §2.1；`asOf` 被大量使用，其余三个只被 README/文档引用。

### 2.5 SOP 结构 — `sop-data.js`

**机房 6 阶段 / 20 个子项**（`sop-data.js:5-38`）：

| # | 阶段名 | 子项数 | 子项 id（类型） | panelTitle / 特殊 |
|---|---|---|---|---|
| 1 | 确认机房信息 | 9 | `ko-plan`(date)、`gpu-arrival`(date)、`deploy-estimate`(date)、`poc-room/poc-project/poc-budget/poc-bke-tce/poc-business`(person)、`business-side`(text) | “机房信息” |
| 2 | 机房预算提交 & 3V创建 | 3 | `budget-submit`(date)、`v3-create`(text, wide)、`machine-arrival`(date) | “预算与 3V” |
| 3 | 机房 KO | 2 | `ko-meeting`(date)、`site-entry`(date) | “机房 KO” |
| 4 | 机房部署 | 2 | `env-record`(**env**)、`cluster-record`(text, wide) | `env:true` → 渲染 13 环境项 + 业务集群列表 |
| 5 | 机房检查 | 2 | `env-verify`(check)、`pre-delivery-check`(date) | 文案写死“确认 **13** 个环境项…”（L31） |
| 6 | 完成 | 2 | `acceptance`(date)、`downstream`(check) | “验收与结项” |

子项类型统计：`date` 9、`person` 5、`text` 3、`check` 2、`env` 1（`env` 不计入“已填 x/y”，`detail-view.js:24-25`）。

**13 个环境项**（`sop-data.js:48-62`）：

| id | 名称 | category | scenes |
|---|---|---|---|
| `bke-meta` | BKE Meta | Basic | `*` → “全场景” |
| `core-cluster` | Core 集群 | Basic | `*` |
| `tce-cluster` | TCE 微服务集群 | Basic | `*` |
| `tlb-npd-riskctl` | TLB - NPD RiskCtl Server | 域名 | Seed 训练 |
| `tlb-gpu-tide` | TLB - GPU Tide | 域名 | Seed 训练 |
| `tlb-godel-stream` | TLB - Godel Stream | 域名 | Seed 训练 / Engine 训练 |
| `tlb-primus` | TLB - Primus | 域名 | Engine 训练 |
| `tlb-history-api` | TLB - History Server API | 域名 | Engine 训练 |
| `exit-code-link` | 退出码链路 | 其他 | Basic |
| `history-log-proxy` | History Log Proxy | 其他 | Seed 训练 |
| `npd-report-link` | NPD 上报链路 | 故障链路 | Basic |
| `kelemetry` | Kelemetry | 其他 | Basic |
| `karl` | Karl | Karl | Seed 训练 / Flow 推理 |

分类固定顺序 `['Basic','域名','其他','故障链路','Karl']`，出现新分类追加到末尾（`detail-view.js:16`）。

**集群 6 阶段**（`sop-data.js:39-46`，纯字符串数组，无 id）：确认需求 / 资源准备+机器重装 / BKE创建 / 人工补齐 / 交付前检查（带 `url`，指向 TCE Checklist 文档）/ 后置通知。

**登记表单采集字段**（`sop-data.js:64`）：`['ko-plan','gpu-arrival','deploy-estimate','poc-room','poc-project','poc-budget','poc-bke-tce','poc-business','business-side']` —— 9 个 id，表单另有 `name` 与 `area` 两个非 SOP 字段。

### 2.6 用户登记机房（Store）字段

`buildout-store.js:15-35` 存储结构：`{id, name, area, fields:{itemId:string}, createdAt}`；`toRoom()` 映射为 Room：

| 映射后字段 | 来源 | 固定/默认 |
|---|---|---|
| `id` | `req-<base36时间戳>-<5位随机>` | — |
| `name` | 表单 | 必填、≤40 字、全局唯一（含演示机房） |
| `vdc` | — | `null` |
| `area` | 表单 | 默认 `cn` |
| `region` | — | `'待确认'` |
| `line` | — | `'待确认'` |
| `tenants` | `fields['business-side']` | 无则 `[]` |
| `poc` | `fields['poc-room']` | 无则 `'待确认'` |
| `phase` | — | **恒 `'future'`** |
| `ko` / `target` | `fields['ko-plan']` / `fields['deploy-estimate']` | 可为 null |
| `delivered` | — | `null` |
| `planCount` | — | `null` |
| `source` | — | `null` |
| `org` / `action` | — | `internal` / `build` |
| `stage` | `deriveStage(stageStatus)`（L11-14） | 无 stageStatus 时 0 |
| `blocker` | — | `''` |
| `demo` / `userRequest` / `createdAt` | — | `true` / `true` / ISO |
| `envStatus` / `stageStatus` / `stageMeta` / `customEnv` | Store | 透传 |
| `fields` | Store | 透传（详情页读） |
| `note` | — | `'机房建设需求登记'` |

### 2.7 用户登记集群（Store）字段

`buildout-store.js:55-61` 存储 `{id, roomId, name, vdc, group, type, tenant, owner, start, target, stage:0, createdAt}`；`toCluster()`（L45-53）追加 `phase:'future'`、`delivered:null`、`blocker:''`、`next:'推进集群六阶段建设'`、`demo:true`、`userRequest:true`，**不写 `slaDays/actualDays/nameConfirmed/source/identitySource`**。ID 形如 `clu-<base36>-<4位随机>`；同机房内名称去重（`detail-view.js:153`）。

### 2.8 `CLUSTER_DELIVERY_DATA` 结构 — `cluster-delivery-data.js`

**顶层**：`asOf`、`rangeStart`、`rangeEnd`、`stages[6]`、`sites[6]`、`clusters[8]`。

**stages**（L6-62）：

| key | name | short | baseline(天) | subItems |
|---|---|---|---|---|
| `demand` | 确认需求 | 需求 | 2 | 3：`scene`/`copy`/`nodelevel` |
| `resource` | 资源准备 + 机器重装 | 资源 | 5 | 4：`list`/`move`/`reinstall`/`offline` |
| `bke` | BKE 创建 | BKE | 8 | 1：`issues`（带 `detail[5]` 标签） |
| `manual` | 人工补齐 | 补齐 | 12 | 6：`app`/`collie`/`association`/`planning`/`localdisk`/`exitcode` |
| `check` | 交付前检查 | 检查 | 2 | 1：`checklist`（`link:true`） |
| `notify` | 后置通知 | 通知 | 1 | 1：`notify` |

baseline 合计 30 天；16 个子项。

**sites**（L63-174）字段：`{id, code, name, region, area, kind, owner, acceptDate, milestones[{name,date,status}], batches[]}`。

| id | code | name | region | area | kind | owner | acceptDate | milestones | batches |
|---|---|---|---|---|---|---|---|---|---|
| `hhdh` | `HHDH` | 内蒙·呼和浩特 | 华北5 | cn | new | 彭康熙 | 2026-12-10 | 3（1 doing / 2 todo） | 2 |
| `wuhan` | `wuhan` | 湖北·武汉 | 华中 | cn | new | 彭康熙 | 2027-02-28 | 3（todo） | 3 |
| `seed-fi` | `seed-fi` | 芬兰·赫尔辛基 | 欧洲 | overseas | new | 井诚 | 2027-03-15 | 3（todo） | 1 |
| `wlby` | `WLBY` | 内蒙·乌兰察布 | 华北5 | cn | existing | 曲强 | null | 0 | 6 |
| `hl` | `HL` | 河北·怀来 | 华北 | cn | existing | 王剑 | null | 0 | 4 |
| `syd2a` | `syd2a` | 澳洲·悉尼 | 澳洲 | overseas | existing | 曲强 | null | 0 | 4 |

**batches**（20 条，字段 `{id,type,state,start,end,count,origin,owner,progress,risk?,members?}`）：

| id | 机房 | type | state | start | end | count | origin | owner | progress | risk | members |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `hhdh-train-b1` | hhdh | 训练 | present | 2026-10-09 | 2026-12-20 | 2 | new-first | 彭康熙 | 0.28 | warn | hhdh-train-01/02 |
| `hhdh-infer-b1` | hhdh | 推理 | future | 2027-01-10 | 2027-02-10 | 1 | new-first | 彭康熙 | 0 | — | — |
| `wuhan-train-b1` | wuhan | 训练 | future | 2027-01-05 | 2027-03-15 | 2 | new-first | 彭康熙 | 0 | — | — |
| `wuhan-train-b2` | wuhan | 训练 | future | 2027-04-01 | 2027-06-10 | 2 | new-first | 彭康熙 | 0 | — | — |
| `wuhan-infer-b1` | wuhan | 推理 | future | 2027-05-10 | 2027-07-01 | 1 | new-first | 彭康熙 | 0 | — | — |
| `fi-train-b1` | seed-fi | 训练 | future | 2027-02-15 | 2027-04-20 | 1 | new-first | 井诚 | 0 | — | — |
| `wlby-train-b1` | wlby | 训练 | past | 2026-04-20 | 2026-06-12 | 2 | existing-add | 曲强 | 1 | — | — |
| `wlby-common-b1` | wlby | 通用 / 微服务 | past | 2026-10-06 | 2026-10-10 | 2 | existing-add | 曲强 | 1 | — | — |
| `wlby-infer-b1` | wlby | 推理 | present | 2026-10-13 | 2026-10-28 | 1 | existing-add | 于子晨 | 0.58 | err | wlby-panda |
| `wlby-train-b2` | wlby | 训练 | present | 2026-10-15 | 2026-11-02 | 1 | existing-add | 曲强 | 0.33 | — | wlby-cloudnative |
| `wlby-train-b3` | wlby | 训练 | present | 2026-10-16 | 2026-11-15 | 1 | existing-add | 韩亮 | 0.17 | — | wlby-seed01 |
| `wlby-infer-b2` | wlby | 推理 | future | 2026-12-01 | 2026-12-28 | 2 | existing-add | 曲强 | 0 | — | — |
| `hl-train-b1` | hl | 训练 | past | 2026-02-10 | 2026-04-05 | 2 | existing-add | 王剑 | 1 | — | — |
| `hl-pool-b1` | hl | 弹性池 | past | 2026-07-15 | 2026-09-12 | 1 | existing-add | 王剑 | 1 | — | — |
| `hl-infer-b1` | hl | 推理 | present | 2026-10-01 | 2026-10-29 | 2 | existing-add | 王剑 | 0.62 | — | hl-infer-01/02 |
| `hl-infer-b2` | hl | 推理 | future | 2026-12-01 | 2026-12-28 | 2 | existing-add | 王剑 | 0 | — | — |
| `syd-common-b1` | syd2a | 通用 / 微服务 | past | 2026-10-07 | 2026-10-10 | 2 | existing-add | 曲强 | 1 | — | — |
| `syd-infer-b1` | syd2a | 推理 | past | 2026-05-20 | 2026-07-20 | 1 | existing-add | 曲强 | 1 | — | — |
| `syd-infer-b2` | syd2a | 推理 | present | 2026-10-12 | 2026-10-30 | 1 | existing-add | 曲强 | 0.45 | warn | syd2a-candy |
| `syd-train-b1` | syd2a | 训练 | future | 2027-01-15 | 2027-02-28 | 1 | existing-add | 曲强 | 0 | — | — |

`count` 合计 30；`origin` 分布 `new-first 6 / existing-add 14`；`risk` 只在 3 条 batch 上出现（`hhdh-train-b1` warn、`wlby-infer-b1` err、`syd-infer-b2` warn）。

**clusters**（8 条显式，L175-240）：

| id | name | siteId | batchId | type | stageIndex | stageDays | subIndex | stagePlan | risk | next |
|---|---|---|---|---|---|---|---|---|---|---|
| `hhdh-train-01` | seed-hhdh-train-01 | hhdh | hhdh-train-b1 | 训练 | 1 | 6 | 0 | [3,8,12,18,4,2] | warn 电力依赖 | 跟进机房电力交付… |
| `hhdh-train-02` | seed-hhdh-train-02 | hhdh | hhdh-train-b1 | 训练 | 1 | 5 | 1 | [3,8,12,18,4,2] | warn 电力依赖 | 与 train-01 合并推进机器调转 |
| `wlby-panda` | panda-wlby | wlby | wlby-infer-b1 | 推理 | 3 | 7 | 0 | [1,2,3,5,2,1] | err databus | 修复 databus 应用健康检查… |
| `wlby-cloudnative` | cloudnative-wlby | wlby | wlby-train-b2 | 训练 | 1 | 5 | 2 | [1,3,4,6,3,1] | null | 完成机器重装，进入 BKE 创建 |
| `wlby-seed01` | seed01-wlby | wlby | wlby-train-b3 | 训练 | 0 | 6 | 2 | [4,5,6,10,3,2] | null | 完成 nodelevel 设计… |
| `syd2a-candy` | candy-syd2a | syd2a | syd-infer-b2 | 推理 | 3 | 5 | 4 | [2,3,4,5,2,1] | warn 交换机 | 跟进交换机到货… |
| `hl-infer-01` | infer-hl-01 | hl | hl-infer-b1 | 推理 | 4 | 2 | 0 | [2,4,6,8,3,1] | null | 完成 TCE Checklist 校验… |
| `hl-infer-02` | infer-hl-02 | hl | hl-infer-b1 | 推理 | 2 | 7 | 0 | [2,4,6,6,2,1] | null | 处理 BKE 创建中的 TLB 异常… |

### 2.9 集群交付页的派生集群（重要）

`allClusters()`（`cluster-delivery-view.js:58-108`）返回 **显式 8 条 + 合成 22 条 = 30 条**：

1. 显式集群补默认值：`state = cluster.state || batch.state`、`end = cluster.end || planEnd || start`、`slaDays = cluster.slaDays || SLA_DAYS(30)`、`group = group || groupFromName(name)`（取名字第一段首字母大写）、`business = business || businessFromCluster()`，再叠加 `clusterState` 内存覆盖（L68）。
2. **合成集群**：遍历所有 `batch.state !== 'present'` 的批次，按 `batch.count` 复制：
   - `id = ${batch.id}-c${n}`，`name = ${site.code.toLowerCase()}-${typeSlug}-${n}`（typeSlug ∈ train/infer/common/pool）；
   - `group = Train/Infer/Core`；`business = batch.type === '通用 / 微服务' ? 'Core' : batch.type`；
   - `stageIndex = batch.state === 'past' ? 6 : 0`，`stageDays 0`，`subIndex 0`；
   - `stagePlan = scaledStagePlan(批次天数)`（按 baseline 比例缩放，最小 1 天，L51-56）；
   - `slaDays = 30`，`risk:null`，`synthetic:true`。
3. `state` 来源是 `batch.state`，**不是日期**；显式集群若被用户改过，则以 `clusterState` 为准（L112-124）。

因此“30 个集群”里只有 8 个在数据文件中有独立记录，另外 22 个是批次计数的投影，**同名不同 id**（例如 `wuhan-train-1` 出现两次，分别来自 `wuhan-train-b1-c1` 与 `wuhan-train-b2-c1`）。

### 2.10 枚举总表

| 枚举 | 取值 | 定义处 | 中文渲染 |
|---|---|---|---|
| `area` | `cn` / `overseas` | 两数据集 | 中国 / 非中（`hierarchy-view.js:9`） |
| Room `phase` | `past` / `present` / `future` | `data.js` | 过去·已交付 / 现在·建设中 / 未来·规划中（`cluster-model.js:5`） |
| Room 阶段状态 | `todo` / `doing` / `done` / `skip` | `cluster-model.js:12`、`buildout-actions.js:12` | 待处理 / 进行中 / 已完成 / 不适用（`detail-view.js:7`） |
| 环境项状态 | `pending` / `doing` / `done` / `skip` | `buildout-actions.js:4` | 同上（`pending` = 待处理，`detail-view.js:8`） |
| Cluster 状态（机房页） | `delivered` / `planned` / `blocked` / `building` / `pending` | `cluster-model.js:6` | 已交付/规划中/有阻塞/建设中/待开始（`hierarchy-view.js:5`） |
| Site `kind` | `new` / `existing` | `cluster-delivery-data.js` | 新机房 / 存量机房 |
| Batch/Cluster `state` | `past` / `present` / `future` | 同上 | 已交付 / 建设中 / 规划中（`cluster-delivery-view.js:10`） |
| `origin` | `new-first` / `existing-add` | 同上 | 新机房首批 / 存量机房扩容（L12） |
| `risk.level` | `warn` / `err` | 同上 | 依赖预警 / 阻塞（L704） |
| 集群类型 | 机房页：通用/训练/推理/微服务；CD：训练/推理/通用 / 微服务/弹性池；登记表单：训练/推理/存储/通用/控制面 | 三处各不相同 | 见 §7-D39 |
| 机房排序 | `date` / `name` / `owner` | `hierarchy-view.js:66` | 按关键日期 / 名称 / 负责人 |

### 2.11 计数（默认无筛选时实测）

| 指标 | 机房页 | 集群交付页 |
|---|---|---|
| 一级实体 | 20 个机房（中国 12 / 非中 8） | 6 个机房（new 3 / existing 3；cn 4 / overseas 2） |
| 子实体 | 20 个集群 | 8 显式 + 22 合成 = **30 个集群**；20 个批次 |
| 三态分布 | past 8 / present 5 / future 7 | past 10 / present 8 / future 12 |
| 集群状态 | delivered 12 / blocked 3 / building 2 / planned 3 | — |
| 计划总数 | 有值 3 个机房（7+6+4=17），**17 个机房待确认** | 批次 count 合计 30 |
| 其他 | 平均机房耗时 44 天；时间线 18 个月（2026/02–2027/07）；今日线 47.44% | 平均交付 35 天；3 个已交付机房；1 个阻塞；4 个阶段超基线；未来 7 新 / 5 存量；时间轴 24 个月（2026/01–2027/12）；今日线 40.14% |
| 每机房集群数（CD） | — | hhdh 3 / wuhan 5 / seed-fi 1 / wlby 9 / hl 7 / syd2a 5 |
| KPI 明细文本 | “中国 12 · 非中 8”“17 个机房计划总数待确认”“完成集群全部 6 个环节”“2 个集群正在建设 · 示例” | “平均耗时 35 天 / 3 个机房”“1 集群阻塞 / 4 阶段超基线”“7 新机房首批 / 5 存量扩容” |

### 2.12 两个数据集的重叠与差异（重建前必须裁决）

**ID 层面几乎不重叠**：

| 对照项 | 结果 |
|---|---|
| 机房 id 交集 | **5 个**：`wlby`、`syd2a`、`hhdh`、`wuhan`、`seed-fi` |
| 仅机房页有 | 15 个：`yx`、`hhhl`、`zhaochuan`、`hb6`、`id4a`、`stone-usw`、`seed-jp`、`my1a`、`seed-hk`、`wlqq`、`kmmh`、`ningxia-az1`、`id4b`、`hlge`、`wlyj` |
| 仅集群交付页有 | **1 个**：`hl`（河北·怀来；机房页没有对应机房，`hb6` 是“华北6 大金融/消金/追光专区”，`hlge` 是“和林格尔”） |
| 集群 id 交集 | **0 个**（机房页 `wlby/Panda` vs CD `wlby-panda`） |
| 集群名交集 | 2 个完全相同：`panda-wlby`、`cloudnative-wlby`；近似：`Seed01（名称待确认）` vs `seed01-wlby`、`Candy` vs `candy-syd2a` |

**同一机房在两侧的数据不一致（可核对的具体冲突）**：

| 机房 | 机房页 | 集群交付页 | 冲突点 |
|---|---|---|---|
| `hhdh` | stage 1（机房 KO 阶段），0 个集群，`planCount:null`，`ko 2026-10-09`，`target 2026-12-10` | kind new，acceptDate 2026-12-10，2 个训练集群在建（`seed-hhdh-train-01/02`）+ 1 个未来推理集群 | 机房页说“0 已录入”，交付页有 3 个集群；机房页“当前：机房 KO”，交付页集群已到“资源准备+机器重装” |
| `wuhan` | stage 0，1 个“规划训练集群（示例）”，`target 2026-12-31` | acceptDate **2027-02-28**，3 批次 5 集群（2027-01 起） | 目标/验收日期差 2 个月；集群数 1 vs 5 |
| `seed-fi` | stage 0，1 个规划集群，`target 2026-11-30` | acceptDate **2027-03-15**，1 批次（2027-02 起） | 日期差 4 个月 |
| `wlby` | 6 个集群（Core/Phlox/Panda/Visa/CloudNative/Seed01），`planCount 6`，2 已交付 / 3 阻塞 / 1 在建 | 9 个集群（3 显式 + 6 合成），past 4 / present 3 / future 2 | 集群数 6 vs 9；`Visa` 在 CD 不存在，CD 多出 4 个训练/通用合成集群 |
| `syd2a` | 4 个集群（Core/Normal01/Bernard-Prod/Candy），3 已交付 | 5 个集群（1 显式 + 4 合成），past 3 / present 1 / future 1 | 数量 4 vs 5；`Bernard-Prod`、`Normal01` 在 CD 不存在 |
| `hl` | 无此机房 | 7 个集群 | 交付页独有 |
| `cloudnative`（wlby 下） | stage 3，阻塞“控制器就绪检查未通过” | stageIndex 1，`risk:null`，“完成机器重装，进入 BKE 创建” | 阶段 3 vs 1，阻塞有 vs 无 |
| `seed01`（wlby 下） | stage 2 | stageIndex 0，`subIndex 2` | 阶段 2 vs 0；且机房页 owner “待确认” vs CD “韩亮” |

**元数据差异**：asOf 相差 3 天（10-18 vs 10-21）；`region` 命名体系不同（机房页内部代码 `China-North5`/`NonTT`，CD 人话 `华北5`/`欧洲`）；机房页有 `sources/sla/planCount/stage`，CD 有 `stages/batches/milestones/origin/risk/stageIndex/stagePlan`，**没有任何字段可以互相映射**（除 id/name/area 外）。

---

## 3. 交互清单

### 3.0 两个页面共用的外壳控件

外壳来自 `index.html:23-67` + `navigation.js` + `compute-ui-kit.js`，两页完全一致。

| 控件 | 位置 / 选择器 | 实际行为 | 状态 | 持久化 | 后端 |
|---|---|---|---|---|---|
| “计算场景”下拉 | `.scene-switch-btn`（index.html:39-45） | **被禁用**：`navigation.js:74-77`（CD 页）与 `app.js:69`（机房页）设置 `disabled=true`、`title="此独立原型仅展示交付与准入相关页面"`。HTML 里只有 `aria-haspopup/aria-expanded`，**没有任何 click 处理** | 无 | — | 需要（生产环境的场景切换） |
| 搜索资源 | `.topbar-tools button`（index.html:48） | 禁用；无处理函数 | 无 | — | 需要（全局搜索） |
| 诊断 Copilot | 同上（L49） | 禁用；无处理函数 | 无 | — | 需要（若保留） |
| 通知 | 同上（L51） | 禁用；无处理函数、无未读角标逻辑 | 无 | — | 需要 |
| 当前用户头像“本” | `.topbar-user__trigger`（L53-55） | 禁用（在 `.topbar-tools` 内，被同一选择器命中）；无菜单 DOM | 无 | — | 需要（登录态/用户菜单） |
| 侧栏 25 个导航项 | `#compute-sidebar-nav [data-view]` | 仅 2 项可点：`机房建设`（`mock` 徽标）与 `集群交付`（无徽标）。点击非当前项 → `location.href = ?view=xxx`（`navigation.js:57-66`）。其余 **23 项 `disabled=true`**，其中 12 项带 `mock` 徽标（`key-progress`、`cluster-fault`、`host-pool`、`host-model`、`iac`、`room-buildout`、`host-admission`、`host-ops`、`cluster-ops`、`other-ops`、`baseline-catalog`、`cluster-env`） | 路由 | URL 参数 | 需要（全部为其它页面占位） |
| 页头“示例数据”徽标 | `computePageShell` → `.csys-data-badge` | 静态，无点击 | 无 | — | — |
| 页面说明（仅 CD 页） | `[data-csys-page-help-open]` | 打开右侧说明抽屉（用途/重点/阅读路径/数据边界）；`compute-ui-kit.js:138-250` 负责开关、遮罩、Esc、焦点陷阱 | 抽屉开合 | 无 | 不需要（内容静态） |

> 机房页**没有**“页面说明”按钮：`app.js:49` 调用 `computePageShell` 时未传 `guidance`，而 CD 页传了（`cluster-delivery-view.js:981-991`）。

### 3.1 机房建设页（`?view` 非 cluster-delivery）

事件委托集中在 `#main` 上的一个 click（`app.js:50-59`）、一个 change（L60-63）、搜索框 input（L64），以及全局 `Esc`（L67）与 `room-buildout-changed` 监听（L66）。

| # | 控件（可见文案） | 选择器 / 定义处 | 点击后发生什么 | 状态变化 | 持久化 | 需要后端 |
|---|---|---|---|---|---|---|
| R1 | 登记机房建设需求 | `[data-request-add]`（app.js:49 页头、L54） | `openRequestForm()`：懒创建 `#rb-request-modal` 并 `.open`；锁 body 滚动；聚焦 name | 打开弹窗 | 无 | 是（提交时） |
| R2 | 参考与口径 | `[data-show-sources]`（页头、L57） | `Details.sources()`：**复用同一个抽屉**，标题改“参考与口径”，正文为范围/阶段/计划数量/来源/缺口六段 + 9 条资料链接 | 抽屉内容模式 | 无 | 否（静态文案） |
| R3 | 查看数据说明 | `.rb-demo-banner button[data-show-sources]`（app.js:49） | 同 R2 | 同上 | 无 | 否 |
| R4 | 来源、时效与缺口 | footer `.rb-name-button[data-show-sources]`（app.js:49） | 同 R2 | 同上 | 无 | 否 |
| R5 | 区域下拉 | `[data-filter="area"]`（app.js:8） | 改 `state.area` → `renderData()` 重算 KPI/三态卡/时间线/清单 | 筛选 | 仅内存 | 是（或客户端） |
| R6 | 集群类型下拉 | `[data-filter="type"]` | 改 `state.type`；选项来自现有集群 type 去重（通用/训练/推理/微服务） | 筛选 | 内存 | 是 |
| R7 | 业务下拉 | `[data-filter="tenant"]` | 改 `state.tenant`；选项来自所有机房的 `tenants` 去重（AML/TCE/Seed/财经支付/Flow/Stone/Engine） | 筛选 | 内存 | 是 |
| R8 | 搜索框 | `.rb-search input`（app.js:64） | **每次 input** 改 `state.query` → 全量重渲染；匹配机房任意字符串字段或其子集群（`cluster-model.js:55-60`） | 搜索 | 内存 | 是 |
| R9 | 重置 | `[data-reset]`（app.js:58） | `reset()`：`Details.close()`、phase 置 **`all`**（不是默认 present）、清 4 个筛选、清排序、写 URL、重渲染 | 重置 | 内存 + URL | 否 |
| R10 | 三态概览卡 ×3 | `.rb-phase-card[data-phase]`（hierarchy-view.js:82-84） | 设 `state.phase`，写 `?phase=`，重渲染；卡片 active 高亮 | phase | 内存 + URL | 否 |
| R11 | 阶段 chip ×4（全部/过去/现在/未来） | `.rb-org-chip[data-phase]`（hierarchy-view.js:66） | 同 R10；chip 上带该阶段机房数 | phase | 同上 | 否 |
| R12 | 排序下拉 | `[data-sort]`（hierarchy-view.js:66） | `state.sort=date|name|owner`，**只重渲染清单**（不重算 KPI/时间线） | 排序 | 内存 | 否 |
| R13 | 恢复默认排序 | `[data-sort-reset]`（app.js:52） | `state.sort='date'`，下拉回填，重渲染清单 | 排序 | 内存 | 否 |
| R14 | 展开完整时间线 / 收起时间线 | `[data-timeline-expand]`（hierarchy-view.js:72；app.js:53） | 翻转 `state.timelineExpanded`，**只重渲染 `#rb-timeline`**；展开后每阶段显示全部机房，收起时每阶段固定 2 条（`hierarchy-view.js:75`） | 展开态 | 内存 | 否 |
| R15 | 时间线条带 / 机房名 | `.rb-tl-bar[data-room]`、`.rb-tl-name[data-room]`（hierarchy-view.js:78） | `Details.open(roomId)` | 打开抽屉 | 无 | 是（读详情） |
| R16 | 机房名 | `.rb-room-name[data-room]`（hierarchy-view.js:43） | 同 R15 | 同上 | 无 | 是 |
| R17 | 阻塞徽标（仅 `wlby` 行） | `.rb-room-status-link[data-room]`（hierarchy-view.js:55） | 同 R15，`title` 显示阻塞文案 | 同上 | 无 | 是 |
| R18 | 机房详情 › | `.rb-room-title-actions .btn[data-room]`（hierarchy-view.js:56） | 同 R15 | 同上 | 无 | 是 |
| R19 | 重置筛选（空态） | `.rb-empty [data-reset]`（hierarchy-view.js:68） | 同 R9 | 重置 | 内存 | 否 |
| R20 | 抽屉关闭 × | `#rb-drawer-close`、`#rb-drawer-backdrop`、`Esc`（detail-view.js:137/140/185） | `close()`：移除 open、恢复 inert、归还焦点、清 `currentRoom/currentCluster/stagePanel/clusterForm` | 关闭 | 无 | 否 |
| R21 | 机房概览 | `[data-detail-room]`（detail-view.js:130） | 清 `currentCluster`，渲染机房概览 | 抽屉视图 | 无 | 是 |
| R22 | 机房内集群列表项 | `[data-detail-cluster]`（detail-view.js:130） | 设 `currentCluster`，渲染集群详情（只读） | 抽屉视图 | 无 | 是 |
| R23 | 登记（集群） | `.rb-cluster-add[data-cluster-add]`（detail-view.js:130） | 渲染“登记集群”表单（替代内容区） | `clusterForm=true` | 无 | 否（提交时） |
| R24 | 阶段卡片 ×6 | `[data-stage-panel]`（detail-view.js:34-35） | 设 `stagePanel=i`，在抽屉内叠加二级面板（600px 宽，`15b` 截图） | 面板 | 无 | 是（读子项） |
| R25 | 阶段状态 4 按钮 | `[data-stage-status]`（detail-view.js:110） | `A.setStageStatus(roomId, stagePanel, status)`；演示机房改内存 + 派发事件，登记机房写 Store；**并重算 `room.stage`**（有缺陷，见 §7-D1） | 阶段状态/进度 | 演示：内存；登记：localStorage `room-buildout-requests-v2` | 是 |
| R26 | 子项输入（日期/负责人/文本） | `[data-field]`（detail-view.js:63-68） | `change` 事件（失焦或选日期）→ `A.setField()`；输入框有值加 `.is-filled`；值直接写 Room.fields | 字段 | 同上 | 是 |
| R27 | 勾选型子项 | `input[type=checkbox][data-field]`（detail-view.js:66） | 勾选写 `'1'`，取消写 `''`；旁边文案切“已确认/待确认” | 字段 | 同上 | 是 |
| R28 | 环境项方块 | `[data-env-item]`（detail-view.js:11、167） | `A.cycleEnv()`：`pending → doing → done → skip → pending` 循环；重渲染抽屉（含计数） | 环境项状态 | 同上 | 是 |
| R29 | 自定义环境项 | `[data-envadd="name|category|scene"]` + `[data-envadd-submit]`（detail-view.js:22、160-165） | `A.addEnvItem()`：name 必填（空则静默 return）；category 默认“其他”，scene 默认“Basic”；新分类自动追加分组 | customEnv | 同上 | 是 |
| R30 | 业务集群卡片 / 登记集群（阶段 4 内） | `.rb-sp-cluster`（只读）+ `[data-cluster-add]`（detail-view.js:79-80） | 卡片不可点；按钮进 R23 | 同上 | — | 是 |
| R31 | 阶段登记：负责人/计划时间/完成时间/备注 | `[data-meta]`（detail-view.js:115-118、171-175） | `change` → `A.setStageMeta()`；备注 textarea 同样在 change 时保存 | stageMeta | 同上 | 是 |
| R32 | 保存登记 | `[data-stage-panel-close]`（detail-view.js:122） | **只关闭面板**，不做保存动作（字段已在 change 时即时写入） | 关闭面板 | — | 否 |
| R33 | 删除登记 | `[data-delete-request]`（detail-view.js:51、168-169） | `A.removeRequest()` 删除 localStorage 记录 → 关闭抽屉 → 列表刷新 | 删除 | localStorage | 是 |
| R34 | 集群详情里的阶段折叠 | 原生 `<details class="rb-sop-items">`（detail-view.js:41） | 仅展开/收起规范子项文案，**不能改集群阶段** | 无 | 无 | 是（若要改阶段） |
| R35 | 资料外链 | `.rb-reference[href]`（hierarchy-view.js:21） | 新窗口打开飞书文档；若 `room.source` 无匹配则不渲染 | 无 | 无 | 否 |

**机房页不可点击 / 无处理的东西**：KPI 四张卡（纯展示）；时间线图例；时间线的“示例基准”标签；today 竖线；`.rb-stage-sync`“自动同步”提示（只是文案）；`.rb-hint-inline`。

### 3.2 机房详情抽屉的结构与全部子控件

抽屉 DOM（`detail-view.js:135-188`）：`#rb-drawer-backdrop` + `#rb-drawer.rb-cluster-drawer`（宽 `min(1040px,96vw)`，`hierarchy.css:96`），头部 `#rb-drawer-title/#rb-drawer-sub`，主体 `#rb-drawer-body`（左 nav + 右内容），另有 `#rb-stage-panel-mount` 挂二级面板。

左导航：

| 元素 | 说明 |
|---|---|
| “机房概览 / 六阶段 SOP · 环境项 · 排期” | `[data-detail-room]`，当前视图高亮 |
| “机房内集群 N” + “登记” | 计数来自 `allClusters().filter(roomId)`；登记按钮 `[data-cluster-add]` |
| 每个集群项 | 名称 + 状态点（`rb-cluster-dot delivered/building/blocked/planned`）+ “类型 · 阶段”；用户登记集群追加“· 登记” |
| 空态提示 | “集群计划待补充，可点上方「登记」补充” |

机房概览（`roomContent`，detail-view.js:43-54）内容块：

1. 标题区：`机房建设 · 内场 · 中国/非中` + 名称 + 状态徽标（已交付/建设中/有阻塞/规划中）。
2. Facts 网格：普通机房 8 项（Region/VDC、机房负责人、建设方向/业务、计划集群、启动/预计启动、实际完成/预计完成、机房耗时或已推进天数、集群交付“x 已交付 · y 阻塞”）；**需求登记机房换成 10 项**（区域、业务方、机房 PoC、项目 PoC、预算 PoC、BKE&TCE PoC、业务 PoC、机器到付时间、机房部署时间、计划集群）。
3. “机房建设阶段”6 张阶段卡（阶段名、状态 pill、meaning、`负责人 + x/y 项已填`、右箭头）。
4. “下一步 / 机房阻塞”条。
5. 仅需求登记机房：登记说明 + “删除登记”。
6. `room.note` 注释、参考资料链接、底部口径长文案（六阶段名称与“机房交付独立验收”说明）。

二级阶段面板（`stagePanelHTML`，detail-view.js:103-124；宽 600px，`15b/35` 截图）控件：

| 区块 | 控件 | 行为 / 写入 |
|---|---|---|
| 头部 | 阶段名 + “机房名 › 阶段登记 · 人工确认” + 关闭 × | 关闭 = `stagePanel=-1` |
| 阶段状态 | 4 个按钮（待处理/进行中/已完成/不适用），当前态高亮 | `data-stage-status` |
| 子项区 | 每个非 env 子项：label + desc + 控件（date / person 文本 / text / check） | `data-field`，change 即存 |
| 环境项（仅阶段 4） | 13 个方块 + 4 状态计数 + 自定义添加行 | `data-env-item` / `data-envadd-submit` |
| 业务集群（仅阶段 4） | 集群卡片（名/类型/阶段/状态点）+ “登记集群” | 只读 + 打开登记表单 |
| 阶段登记 | 阶段负责人、计划时间、完成时间、备注 | `data-meta`，change 即存 |
| 底部 | “保存登记”（= 关闭）+ “保存后同步到机房建设清单与时间线” | 无实际保存逻辑 |

### 3.3 登记机房建设需求弹窗（机房页）

DOM 由 `app.js:29` 内联构造，`#rb-request-modal`（`.rb-modal-root`，z-index 1000），卡片 `.rb-modal-card-wide`（600px，room-buildout.css:438）。

字段（11 个）：

| 字段 | name | 类型 | 约束 / 默认 | 备注 |
|---|---|---|---|---|
| 机房项目名 * | `name` | text | `required`、`maxlength=40`、去重（对所有 `allRooms()` 精确同名） | 空提交被浏览器 `required` 拦截，**自定义错误行不显示**（`#rb-request-error` 仍为空） |
| 区域 | `area` | select | 中国 / 非中，默认 中国 | — |
| 业务方 | `business-side` | text | maxlength 30 | 写入 `fields`，同时成为 `tenants[0]` |
| 预计启动时间 | `ko-plan` | date | 无默认 | 时间线起点 |
| 预计完成 · 机房部署时间 | `deploy-estimate` | date | 无默认 | 时间线终点 |
| 机器到付时间 | `gpu-arrival` | date | 无默认 | — |
| 机房 PoC | `poc-room` | text | maxlength 20 | 成为 `poc` |
| 项目 PoC | `poc-project` | text | maxlength 20 | — |
| 预算 PoC | `poc-budget` | text | maxlength 20 | — |
| BKE & TCE PoC | `poc-bke-tce` | text | maxlength 20 | — |
| 业务 PoC | `poc-business` | text | maxlength 20 | — |

行为：

- 打开：`data-request-add` → 首次创建 DOM，之后复用；`.open` + body `rb-modal-open`；聚焦 name。
- 关闭：× / 背景 `[data-close-form]` / 取消 / `Esc`（`app.js:67`，全局监听，两页都生效）。
- 提交（`app.js:32-42`）：`preventDefault` → trim name → 空则自定义错误“请填写机房项目名”（实际被 required 提前拦截）→ 重名则“已存在同名机房 / 需求登记” → 收集 `requestItemIds` 中非空字段 → `Store.add(name,{area,fields})` → `form.reset()` → 关闭 → `state.phase='all'` + 写 URL → `renderData()`。
- 结果：新机房排在合并列表最前（`mergeRequests` 把登记项放前面），但列表按日期排序后位置不固定；阶段 1，`phase:'future'`；行上出现“需求登记”chip；KPI 机房数 +1、待确认机房数 +1。
- 持久化：localStorage `room-buildout-requests-v2`（数组，`unshift`）；刷新后仍在（`19b/19c/19d` 截图）。
- 后端：需要“创建机房需求 + 阶段 1 字段”的写接口；当前**无编辑/撤销**（只能整条删除）。

### 3.4 集群交付页（`?view=cluster-delivery`）

事件绑定在 `#main`（`cluster-delivery-view.js:915-970`）与抽屉（L392-410）。

| # | 控件（可见文案） | 选择器 / 定义处 | 行为 | 状态 | 持久化 | 需要后端 |
|---|---|---|---|---|---|---|
| C1 | 登记集群建设需求 | `[data-cd-register]`（L980、L934） | `openRegister()`：抽屉换成 11 字段表单；机房默认第一个 `kind==='new'`（hhdh）→ origin 自动 `new-first`；start 默认 asOf，end 默认 asOf+90 天 | 抽屉模式 | 无 | 是 |
| C2 | 导出清单 | `[data-cd-export]`（L980、L943） | `exportCsv()`：对 **当前筛选结果** `visibleClusters()` 生成 14 列 CSV，`\ufeff` BOM，文件名 `集群交付清单_2026-10-21.csv`；Toast 报告条数 | 无（下载） | 无（客户端生成） | 否（若要服务端导出则需要） |
| C3 | 页面说明 | `[data-csys-page-help-open]`（compute-ui-kit.js:67） | 打开说明抽屉（用途/分析重点/4 条阅读路径/数据边界） | 抽屉 | 无 | 否 |
| C4 | 区域 / 机房 / 类型 下拉 | `[data-cd-filter="area|kind|type"]`（L899-902） | 改 `state.area/kind/type` → `render()`；类型用 `cluster.type.includes(value)`，所以“通用”会同时命中“通用 / 微服务” | 筛选 | 内存 | 是 |
| C5 | 搜索 | `#cd-search`（L903，input 事件 L951-955） | `state.query`；匹配 site.name/region/code/owner + cluster.type/id/name/group/business/owner | 搜索 | 内存 | 是 |
| C6 | 重置 | `[data-cd-reset]`（L904、L935-942） | 清 area/kind/type/source/query 与三个 select、搜索框，`render()` | 重置 | 内存 | 否 |
| C7 | 交付来源分段 ×3 | `[data-cd-source="all|new-first|existing-add"]`（L276-280） | 设 `state.source`，重渲染；**按钮上的数字是全局计数**（`sourceCounts()` 不过滤，L145-152），筛选后仍显示 30/9/21 | 筛选 | 内存 | 是 |
| C8 | 展开完整时间线 / 收起 | `[data-cd-expand]`（L268、L927-931） | 翻转 `state.expanded`；**只有存在某组 >2 个集群时才渲染该按钮**；展开后每组全显，否则每组预览 2 条（L237-239） | 展开态 | 内存 | 否 |
| C9 | 时间线条带 / 行 | `button.cd-tl-row[data-cluster]`（L253） | `openCluster(id)` | 抽屉 | 无 | 是 |
| C10 | 集群清单行 | `div.cd-cluster-row[data-cluster][role=button][tabindex=0]`（L339） | 点击或 `Enter/Space`（L956-962）打开抽屉 | 抽屉 | 无 | 是 |
| C11 | 抽屉关闭 × / 遮罩 / Esc | `[data-cd-close]`、`#cd-drawer-backdrop`、L963-969 | 关闭抽屉；Esc 先关子抽屉再关主抽屉 | 抽屉 | 无 | 否 |
| C12 | 阶段手风琴 | 原生 `<details class="cd-stage-acc">`（L500） | 展开/收起该阶段；当前阶段默认 `open` | 无 | 无 | 是（读阶段） |
| C13 | 编辑阶段 ✎ | `[data-cd-stage-edit="${i}"]`（L508、L540-544） | 显示该阶段的行内编辑面板（同一时刻只开一个）。**若目标阶段是收起的，面板渲染在折叠的 body 内，点击后视觉上无变化**（见 §7-D15） | 面板 | 无 | 是 |
| C14 | 阶段状态下拉 + 保存/取消 | `[data-cd-stage-editor-status]` + `[data-cd-stage-editor-save]`（L523-537、L561-589） | 保存逻辑：`done && si>=stageIndex` → `stageIndex=si+1`、`subIndex=0`、`stageDays=0`，若 `>=6` 则 `state='past'`、`end=asOf`；`doing` → `stageIndex=si`、`stageDays=1`、`state='present'`、清该阶段子项完成标记；`todo` → `stageIndex=si`、`stageDays=0`、`state='present'`、清标记。随后 toast + 刷新抽屉 | 阶段/状态/结束日 | **仅内存**（`clusterState` Map，L15/L112-124） | 是 |
| C15 | 子项按钮 | `[data-cd-sub-edit="stage:sub"]`（L479） | `openSubEditor()`；**已交付集群 → toast“已交付集群的子项已全部完成”；`stageIndex` 之前的阶段 → toast“该阶段已完成”**，两种情况都打不开编辑器 | 子抽屉 | 无 | 是 |
| C16 | 子项编辑器：字段 + 取消/标记完成 | `#cd-sub-drawer`（L604-686） | 字段按子项 key 分支：`scene` → 6 个字段（业务场景 select、集群组 text、project 类型 select、训练/推理方向 select、copy 标杆集群 select、nodelevel text）；`copy` → 1 个 select；`nodelevel` → 1 个 text；其余 → 1 个“完成说明”textarea。保存：写 `subItemData[stage:sub]`、`subDone[...]=true`；若该阶段子项全完成且是当前阶段 → `stageIndex+1`（全完成则 `past` + `end=asOf`）；否则推进 `subIndex` | 子项/阶段 | **仅内存** | 是 |
| C17 | “下一步：…”条 | `[data-cd-next]`（L731、L687-691） | 打开**当前阶段**的编辑面板（`toggleStageEdit(stageIndex)`） | 面板 | 无 | 否 |
| C18 | 同批集群 | `.cd-batch-member[data-cluster]`（L733） | 打开同 `batchId` 的其它集群抽屉；无同批则整块不渲染 | 抽屉 | 无 | 是 |
| C19 | 登记表单 11 字段 + 提交/取消 | `#cd-register-form`（L751-853） | 见 §3.5 | 表单 | 无 | 是 |
| C20 | Toast | `#cd-toast`（L856-869） | `role=status`，2.6s 自动消失；不可点击 | 无 | 无 | 否 |

**集群交付页不存在的控件**（需求描述里提到但代码中没有）：

- **“批次/集群”切换开关**：现网页面没有；`cluster-delivery-view.js` 中“批次”一词 0 次出现。旧版 `cluster-delivery-view-v1.js` 有 `openBatch()`/`batchDrawer()`（v1:512-527、L543），即“批次抽屉”，但也**不是切换开关**，而且该文件未被加载。
- **时间轴按机房分行**：现网是“过去/现在/未来”三组，每组一个集群一行（L261-265）；v1 才是按机房分行 + 三条泳道 + 机房验收里程碑虚线。
- **集群详情里的里程碑/依赖区块**：v1 有 `dependencyHTML()`（v1:471），现网没有。
- **TCE Checklist 外链**：现网把 `link:true` 的子项渲染成按钮并打开备注编辑器（§7-D17）。

### 3.5 集群登记表单（抽屉内）

| 字段 | name | 类型 / 默认 | 行为 |
|---|---|---|---|
| 机房 | `siteId` | select，6 个机房，默认第一个 `kind==='new'`（hhdh） | change 时按 `kind` 自动改 `origin` |
| 集群名称 | `name` | text，required | 必填；**全局唯一**（对 `allClusters()`，含合成集群） |
| 集群组 | `group` | text，默认 `Core` | 空则回落 `Core` |
| 业务线 | `business` | text，默认 `TCE` | 空则回落 `type` |
| 类型 | `type` | select：训练/推理/通用 / 微服务/弹性池，默认训练 | change 时把 business 改为 `Seed/Infer/TCE/Pool` |
| 交付来源 | `origin` | select：new-first/existing-add | 随机房类型自动设置 |
| 计划启动 | `start` | date，默认 `2026-10-21`，min/max = rangeStart/rangeEnd | required |
| 目标交付 | `end` | date，默认 `2027-01-19`（asOf+90），min/max 同上 | required；必须晚于 start |
| 负责人 | `owner` | text，默认 `杨明磊` | 空则回落 `杨明磊` |
| SLA 天数 | `slaDays` | number，默认 30，min 1 max 180 | `Math.max(1, Number()||30)` |
| 需求说明 | `note` | textarea | 选填；详情里以“需求说明”区块展示 |

校验（`submitRegister`，L779-817）：`novalidate` 关闭浏览器校验，只做四类 JS 校验——空名称、重名、机房无效、日期缺失/顺序。成功后 `D.clusters.push(cluster)`（L809，**直接改全局数据集**）、关闭抽屉、`render()`、toast；`isNew` 2.6s 后清除（L812-815，用于入场动效）。**没有 localStorage**；表单提示写的是“仅保存在当前浏览器会话，刷新后恢复示例数据”（L771），与机房页的 localStorage 行为不一致。

### 3.6 键盘、焦点、可访问性

| 页面 | 行为 | 代码 |
|---|---|---|
| 机房页 | 抽屉内 `Tab` 焦点循环、`Esc` 先关阶段面板再关抽屉 | `detail-view.js:183-187` |
| 机房页 | 抽屉打开时 `#main/#app-sidebar/.app-header` 设 `inert`；关闭时恢复；焦点归还触发元素 | `detail-view.js:189-191` |
| 机房页 | 全局 `Esc` 关登记弹窗 | `app.js:67` |
| 机房页 | 阶段面板 `role="dialog"` 但 `aria-modal="false"`，**无焦点陷阱** | `detail-view.js:107` |
| 机房页 | 机房行横向滚动容器 `role="region" tabindex="0"` | `hierarchy-view.js:39` |
| CD 页 | `Esc` 先关子抽屉再关主抽屉；主抽屉 `inert` 同机房页 | `cluster-delivery-view.js:963-969`、L421-424 |
| CD 页 | **无焦点陷阱**；抽屉打开后焦点给关闭按钮 | L425 |
| CD 页 | 每次 `renderTimeline()` 都把焦点强制给“展开完整时间线”按钮 | L308-309 |
| CD 页 | 清单行支持 `Enter/Space`；时间线行本身是 `<button>` | L956-962 |
| 两页 | `prefers-reduced-motion` 与 `:focus-visible` 质量底线在 design-system.css:2489-2510 | — |

### 3.7 持久化矩阵

| 数据 | 载体 | key | 刷新后 | 跨页可见 |
|---|---|---|---|---|
| 演示机房的阶段状态/阶段元信息/子项值/环境项/自定义环境项/`stage` | **内存**（直接改 `data.js` 对象） | — | **丢失** | 仅当前页 |
| 需求登记机房（含上述所有编辑） | localStorage | `room-buildout-requests-v2`（v2） | 保留 | 机房页；CD 页不读 |
| 机房内登记的集群（含未登记机房的集群） | localStorage | `room-buildout-clusters-v1`（v1） | 保留 | 机房页；CD 页不读 |
| 删除登记 | localStorage 删除 | 同上 | 保留 | 机房页 |
| 机房页 phase | URL `?phase=` | — | 保留 | 可分享 |
| 机房页 area/type/tenant/query/sort/timelineExpanded | 内存 | — | 丢失 | 否 |
| CD 页全部状态（筛选/展开/阶段推进/子项/登记集群） | 内存（`state`、`clusterState` Map、被就地修改的 `D.clusters`） | — | **全部丢失** | 否 |
| CD 页筛选/展开 | 内存 | — | 丢失 | 否 |

> 两页都**不写任何后端**，也不发任何网络请求（除字体 CSS 与用户点击的外链）。`localStorage` 只在 `buildout-store.js` 出现（L16/20/39/43），CD 页完全没有持久化代码。

---

## 4. 时间与派生逻辑

### 4.1 asOf 基准（两个页面不同）

| 常量 | 值 | 定义处 | 用途 |
|---|---|---|---|
| `D.asOf`（机房页） | **2026-10-18** | `data.js:59` | 在建机房“已推进 N 天”、机房详情“机房耗时”、集群详情“累计耗时”（`actualDays` 为空时）、时间线今日线、页脚“示例基准 2026-10-18”、参考与口径副标题 |
| `D.asOf`（集群交付页） | **2026-10-21** | `cluster-delivery-data.js:3` | 在建集群“已耗时”、抽屉“已耗时 / 计划”、SLA 超期、今日线、筛选条“数据截至 2026-10-21”、导出文件名 |
| `TODAY`（CD） | `Date.parse(asOf)` | `cluster-delivery-view.js:8` | **只用于今日线**（L274/298） |
| `referenceSnapshotDate` | 2026-10-12 | `data.js:61` | 仅 README/文案引用，代码无读取 |
| `sourceReadAt` | 2026-10-18 | `data.js:62` | 仅文案 |
| `rangeStart/rangeEnd` | 2026-01-01 / 2028-01-01 | CD L4-5 | 时间轴固定范围、登记表单日期 min/max |
| `cluster-sop.readAt` | 2026-10-18 | `data.js:56` | 参考与口径展示 |

### 4.2 “过去 / 现在 / 未来”如何派生

**关键事实：两页都不是按日期判断，全部按数据里的阶段/状态字段判断。**

机房页（`cluster-model.js:9-10`）：

```js
roomStage = r => Number.isInteger(r.stage) ? clamp(r.stage,0,6)
             : r.phase === 'past' ? 6 : r.phase === 'present' ? 4 : 0;   // 兜底
roomPhase = r => roomStage(r) >= 6 ? 'past' : roomStage(r) > 0 ? 'present' : 'future';
```

- 因此 `data.js` 里的 `phase` 字段**只在 `stage` 非整数时才参与**；20 条数据的 `stage` 全是整数，`phase` 是纯装饰（且与 stage 一致）。
- 判定结果：stage 6 → 过去；stage 1–5 → 现在；stage 0 → 未来。
- **没有任何“今天 vs target”的比较**：`wlby` 的 target 是 2026-10-18（= asOf，且早于真实今天 2026-10-24）仍显示“现在 · 建设中”。

机房页的集群（`cluster-model.js:6-7`）：

```js
clusterStatus = c => c.stage >= 6 ? 'delivered' : c.phase === 'future' ? 'planned'
                 : c.blocker ? 'blocked' : c.phase === 'present' ? 'building' : 'pending';
clusterPhase  = c => c.stage >= 6 ? 'past' : c.phase === 'future' ? 'future' : 'present';
```

- 注意 `clusterStatus` 用的是**存储的 `c.phase`**，`clusterPhase` 才是派生；两者混用导致 `pending` 实际不可达（phase past + stage<6 + 无阻塞时才会出现，当前数据没有）。

机房的六阶段状态（`cluster-model.js:13-18`）：

```js
roomStageStatus(r,i) = r.stageStatus?.[i] 合法则用之；
否则 i < roomStage(r) ? 'done' : (i === roomStage(r) && roomStage(r) < 6) ? 'doing' : 'todo'
```

- `skip` 只可能来自手工登记，兜底不会产生 `skip`。
- `roomStageProgress` 的 `counts` 用上面的派生，但 `current` 直接读**原始 map**（`stages[i]`），这就是 §7-D1 的根因。

集群交付页：

- 显式集群 `state = cluster.state || batch.state`（`cluster-delivery-view.js:63`）；合成集群 `state = batch.state`（L90）。`cluster.state` 列在数据文件中**一条都没有**，全部来自 batch。
- 用户在页内推进阶段时直接改 `cluster.state`（`past`/`present`），见 `saveStageEdit`/`saveSubEditor`。
- **没有日期比较**，`asOf` 不参与三态判定。

### 4.3 耗时 / SLA / 超期 / 阶段计划

| 计算 | 公式 | 定义处 | 是否展示 |
|---|---|---|---|
| 机房计划耗时 | `daysBetween(ko, target)` | `cluster-model.js:51-54` | 否（返回 `planned` 但视图未用） |
| 机房实际耗时 | `daysBetween(ko, delivered)` | 同上 | 是：过去机房“总耗时 N 天”、KPI 平均 44 天 |
| 机房超期 | `actual - planned` | 同上 | **返回但从未渲染**（`over` 字段无消费者） |
| 集群实际耗时 | `actualDays ?? daysBetween(start, delivered || asOf)`；future 为 null | `cluster-model.js:46-50` | 是：集群详情“累计耗时” |
| 集群 SLA 超期 | `actual - slaDays` | 同上 | **返回但从未渲染**；详情把 SLA 与 actual 分两格显示 |
| 机房列表“已推进” | `daysBetween(ko, asOf)`（present） | `hierarchy-view.js:37`、L51 | 是 |
| CD 在建耗时 | `daysBetween(start, asOf)` | `cluster-delivery-view.js:325`、L700 | 是：清单“耗时 / SLA”、抽屉 |
| CD 超 SLA | `elapsed > slaDays（常量 30）` → 文案“超 N 天” | L327-330、L727 | 是；因为 SLA 恒为 30，长周期集群全部显示超期（如 `hl-train-*` “SLA 30天 · 超24天”） |
| CD 阶段超基线 | `stageDays - stagePlan[stageIndex]`（>0 时显示） | L702、L731 | 是：抽屉标题“· 当前阶段超基线 N 天”、KPI“N 阶段超基线” |
| CD 平均交付 | 过去集群 `daysBetween(start,end)` 的算术平均 | L163-165 | 是：KPI“平均耗时 35 天” |
| CD 阶段计划窗口 | 从 `start` 起按 `stagePlan[i]` 顺序累加，得到每阶段 `planStart/planEnd` | L442-460 | 是：手风琴 meta“计划 MM/DD–MM/DD” |
| CD 阶段“实际天数” | 已完阶段 = `planDays`（数据里没有真实阶段耗时；`slip` 从未定义）；当前 = `stageDays` | L452-456 | 是：“实际 N 天 · 基线 N 天” |

**两处算术不自洽（重建时会被用户发现）**：

1. `hhdh-train-01/02` 的 `stagePlan` 合计 `3+8+12+18+4+2 = 47` 天，从 `start 2026-10-09` 推算阶段计划结束于 **2026-11-25**，而 `planEnd/target` 是 **2026-12-20**（72 天），相差 25 天；其余 6 条显式集群的 stagePlan 合计都恰好等于窗口（如 `wlby-cloudnative` 18 天 vs 10-15→11-02 18 天）。
2. 阶段“实际天数”在数据中不存在，已完阶段直接复用计划天数，所以“实际 = 基线”永远成立、`over` 永远不触发（除非当前阶段 `stageDays` 超基线）。

### 4.4 时间线几何

#### 机房页（`hierarchy-view.js:70-81` + `cluster-model.js:84-108`）

| 要素 | 规则 |
|---|---|
| 月份轴 | 取**当前筛选结果**所有 `ko/target/delivered` 的年月最小～最大，逐月生成；`key = YYYY-MM`，`label = YYYY/MM`。默认 18 个月（2026/02–2027/07） |
| 边界 | `[首月1日, 末月+1月1日)`，UTC 毫秒 |
| 定位 | `(date - bounds0) / (bounds1 - bounds0) * 100%` |
| 条带 | `end = delivered || target`；有 ko 有 end → `left=pos(ko)`，`width=(pos(end)-pos(ko))+1天占比`（右端含当天），上限 `100-left`；只有 end 无 ko → `left=pos(end), width=0`，渲染为 9px 菱形“里程碑”并提示“仅完成节点 · 补预计启动即显示时间段”；有 ko 无 end → 只有 1 天宽的细条 + 同样提示；ko/end 都空 → 不画条，显示“排期待确认” |
| 今日线 | `pos(asOf)`，用 CSS `calc(var(--rb-tl-label) + (100% - var(--rb-tl-label) - var(--rb-tl-end)) * pct)` 叠加在轨道区；`--rb-tl-label:240px`、`--rb-tl-end:140px`（hierarchy.css:24） |
| 行分组 | 过去/现在/未来三段，每段标题“过去 · 已交付 · 8 个机房”；未展开时每段只渲染前 2 行并标注“预览 2 个” |
| 网格 | `.rb-tl-track` 用 `--months` 生成等分竖线背景 |
| 过滤联动 | 轴、条、今日线都随筛选重算 —— **搜索 `wlby` 时轴缩成 2026/09–2026/10 两个月**，条带与今日线位置全部跳变（`07` 截图 vs `01` 截图） |
| 空态 | 无筛选结果时返回 `<div class="rb-empty-inline">当前筛选无可展示机房</div>`（L73），连轴都不渲染 |

#### 集群交付页（`cluster-delivery-view.js:222-310`）

| 要素 | 规则 |
|---|---|
| 月份轴 | **固定**按 `rangeStart..rangeEnd` 生成：2026/01–2027/12 共 24 个月列 + 两个年份标签；不随筛选变化 |
| 定位 | `pct = (date - 2026-01-01) / (2028-01-01 - 2026-01-01) * 100`，`barRatio` 夹在 0–100 |
| 条带 | `left=pct(start)`，`width=max(pct(end)-pct(start), 0.5)%`；风险红点定位在 `calc(end% + 5px)` |
| 今日线 | `--pct = (TODAY - START)/(END - START)` → 0.4014；由 CSS 画竖线 |
| 行分组 | 过去/现在/未来三组，组内按 `start` 升序；未展开时每组前 2 条并标“预览 2 个” |
| 网格 | `.cd-tl-grid` 背景画 24 列/年分隔 |
| 起点/终点标签 | 右侧只显示 `cluster.end`（不显示 start，start 在 title 与行内文案里） |

### 4.5 如果跑在真实“今天”（2026-10-24），哪些可见数字会变

前提：两页的 asOf 是写死常量，不做运行时取今天。若把 `data.js:59` 改为今天、`cluster-delivery-data.js:3` 改为今天，变化如下。

| 页面 / 元素 | 现值（asOf 10-18 / 10-21） | 真实今天 10-24 | 原因 |
|---|---|---|---|
| 机房列表“已推进 N 天” · wlby | 28 天 | **34 天** | `daysBetween(ko, asOf)` |
| 同上 · syd2a | 30 天 | **36 天** | 同上 |
| 同上 · hhdh | 9 天 | **15 天** | 同上 |
| 同上 · my1a | 47 天 | **53 天** | 同上 |
| 同上 · seed-hk | 23 天 | **29 天** | 同上 |
| 机房详情“机房耗时”（present） | 同上 5 个值 | +6 天 | `detail-view.js:46` |
| 机房时间线今日线 | 47.44% | **48.53%** | `timelinePosition(asOf)`（默认 18 个月轴） |
| 集群详情“累计耗时”（present 且 actualDays=null：Panda/Visa/CloudNative/Seed01/Candy） | 5 天 | **11 天** | `clusterDuration` 用 asOf |
| CD 在建集群“已耗时” · infer-hl-01 | 20 天 | **23 天** | `daysBetween(start, asOf)` |
| 同上 · infer-hl-02 | 13 天 | **16 天** | 同上 |
| 同上 · hhdh-train-01/02 | 12 天 | **15 天** | 同上 |
| 同上 · candy-syd2a | 9 天 | **12 天** | 同上 |
| 同上 · panda-wlby | 8 天 | **11 天** | 同上 |
| 同上 · cloudnative-wlby | 6 天 | **9 天** | 同上 |
| 同上 · seed01-wlby | 5 天 | **8 天** | 同上 |
| CD 今日线 | 40.14% | **40.55%** | `(TODAY-START)/730` |
| CD 抽屉“已耗时 / 计划” | 同上 | +3 天 | L700/727 |
| CD 导出 CSV 的“耗时”列（在建行） | 同上 | +3 天 | L876 |
| CD 登记表单默认“计划启动” | 2026-10-21 | **2026-10-24** | `value="${D.asOf}"`（L764） |
| CD 登记表单默认“目标交付” | 2027-01-19 | **2027-01-22** | `asOf+90`（L755） |
| **不会变**：三态分组、past/present/future 计数、已交付耗时、平均耗时、阶段分布、阶段超基线、SLA 是否超期（上述最大 23 天 < 30） | — | — | 全部来自存储字段，不做日期判定；`over` 也不会因今天而触发 |

> 另有一个“显示与真实时间脱节”的直接后果：`wlby` 目标 2026-10-18 已过、`syd2a` 目标 2026-10-08 已过、`infer-hl-01` 目标 2026-10-25 即将到期，页面仍按“建设中”显示，且没有任何“已逾期”标记（`over` 未被渲染）。

---

## 5. 视觉资产

### 5.1 CSS 文件职责与层叠关系

加载顺序（`index.html:14-18`）：`design-system.css` → `tailwind.css` → `room-buildout.css` → `hierarchy.css` → `cluster-delivery.css`。后加载的同名选择器覆盖前者，本原型里有 3 处真实覆盖：

| 覆盖链 | 结果 |
|---|---|
| `.drawer`（design-system.css:2137，`width:520px`，z-index 50） → `.rb-drawer`（room-buildout.css:146，`min(720px,94vw)`） → `.rb-cluster-drawer`（room-buildout.css:203，`min(980px,94vw)`） → `.rb-cluster-drawer`（hierarchy.css:96，`min(1040px,96vw)`） | 机房抽屉最终 **1040px**，`.rb-drawer` 的 720px 永远不生效（同元素同时带 `rb-drawer rb-cluster-drawer`） |
| `.rb-timeline-scroll`（hierarchy.css:24，`max-height:400px; overflow:auto`） + `.full`（同文件，`max-height:none`） | 未展开时时间线内滚动；展开后整页滚动（页面高度 4,952px，见 `10b` 截图） |
| `#rb-stage-panel-mount`（room-buildout.css:504，`min(600px,52vw)`） + 媒体查询 L546（`width:100%`） | 二级面板在宽屏覆盖抽屉右侧 600px，窄屏全宽 |
| `.cd-drawer`（cluster-delivery.css:208）与 design-system 的 `.drawer` | CD 页**不使用** `.drawer` 类，自己实现 540px 抽屉（z-index 1395），与机房抽屉互不影响 |

各文件职责：

| 文件 | 角色 | 主要内容 |
|---|---|---|
| `design-system.css` | 生产版设计系统（“AI Factory 资源管理平台”），本原型只用到约 150 个类（1,291 个选择器中约 12%） | token、dark 主题、boe 站点品牌覆盖、按钮/chip/表单/侧栏/顶栏/页壳/csys-* KPI/表格/抽屉/图表/主机运营/数据中心等大量未使用模块 |
| `tailwind.css` | **手写工具类子集**（37 条规则），不是 Tailwind 构建产物 | 只覆盖 `index.html` 外壳实际用到的 33 个类 |
| `room-buildout.css` | 机房页组件层（550 行，23 个小节） | 阶段卡/阶段轨/阶段面板/环境项/登记弹窗/登记信息条/机房内集群/旧版看板与表格残留 |
| `hierarchy.css` | 机房页“层级”组件（146 行，单节） | 筛选条、三态卡、时间线（轴/条/今日线/图例）、机房行、抽屉宽度覆盖 |
| `cluster-delivery.css` | 集群交付页整页视觉层（317 行，22 小节） | 三态总结卡、筛选、来源分段、时间轴（24 列网格/今日线/条带/风险点）、清单表（9 列，min-width 1180px）、抽屉（540）、阶段手风琴、子项编辑器、子抽屉（420）、登记表单、Toast、响应式 |
| `cluster-delivery-v1.css` | 旧版（未加载） | 泳道时间轴、批次标签、阶段看板、在建流水线表、风险列 |

### 5.2 设计 token 系统

全部 token 定义在 `design-system.css`：**首个 `:root` 54 个**（L6-25），全文件共定义 **121 个**不同 token（含暗色 `:root[data-theme="dark"]` L27-58 的 `--stab-*` 扩展）；被 `var()` 引用 **93 个**、共 2,377 处。**7 个被引用但从未定义**：`--mono`、`--font`、`--shadow-xs`、`--lane`、`--fr-cols`、`--domain-help-left`、`--domain-help-top`（均属其它页面残留，本原型两页未命中）。

| 分组 | token | 值 | 用途 |
|---|---|---|---|
| 画布/面板 | `--bg` `--bg-1` `--bg-2` `--panel` `--border` `--border-2` | `#F5F7FA` `#FFFFFF` `#EEF1F6` `#FFFFFF` `#E6EAF0` `#EEF1F6` | 页面底色、卡片、分割线 |
| 文本 | `--text-1` `--text-2` `--text-3` | `#0F1B2D` `#4A5875` `#8894AB` | 三级文字 |
| 品牌 | `--primary` `--primary-2` `--primary-soft` `--primary-soft-hover` `--primary-border` `--deep` | `#1E4FD8` `#2E63F0` `#EAF0FF` `#DDE7FF` `rgba(30,79,216,.35)` `#0A2A6B` | 主色、选中、描边 |
| 站点品牌别名 | `--site-brand` `--site-brand-2` `--site-brand-soft` `--site-brand-border` `--site-brand-text` `--site-brand-mark-start/end/shadow` `--site-brand-badge-bg/text` | 默认全部指向 primary；`:root[data-app-site="boe"]` 时切成 err 红（L60-78） | 顶栏 logo、Prototype 徽标（**原型没有设置 `data-app-site`，boe 分支不可达**） |
| 语义色 | `--ok` `--ok-soft` `--ok-text`；`--warn` `--warn-soft` `--warn-text` `--warn-border`；`--err` `--err-2` `--err-soft` `--err-border`；`--violet` `--violet-soft`；`--cyan` `--cyan-soft` | `#16A26A/#E5F5EE/#0E6E49`、`#D89A18/#FCF3DE/#8A6409`、`#D14343/#FF5A5F/#FCE9E9`、`#6B4CE6/#EFEBFB`、`#0EA5B7/#E0F5F7` | chip、状态、阶段轨、环境项 |
| 遮罩/阴影 | `--overlay` `--chart-mask` `--shadow-sm/md/lg` | `rgba(15,27,45,.32)`、`rgba(255,255,255,.6)`、三档阴影 | 抽屉/弹窗/卡片 |
| 尺寸 | `--app-header-height` `--control-compact-height` | `56px` `28px` | 顶栏高度、紧凑控件 |
| 其它 | `--surface-hover` `--surface-raised` `--on-accent` `--on-success` `--bg-translucent` `--scroll-thumb(-hover)` | — | 悬停、滚动条 |

暗色主题（`:root[data-theme="dark"]`，L27-58）与 `data-app-site="boe"` 分支**在原型中都没有开关**，`index.html` 的 `<html>` 没有任何 data 属性，因此两页永远是亮色 + 默认品牌色。

### 5.3 外部依赖

| 依赖 | URL / 形式 | 作用 | 风险 |
|---|---|---|---|
| 字体样式 1 | `https://miaoda.feishu.cn/fonts/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap`（index.html:12） | Inter + Noto Sans SC | 内网/离线环境会掉字体，回退到 `system-ui,-apple-system,"Segoe UI"`（design-system.css:84） |
| 字体样式 2 | `https://miaoda.feishu.cn/fonts/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`（index.html:13） | Material Symbols 图标字体 | 离线时图标全部失效；页面没有运行时降级检测（见 §5.5） |
| favicon | 内联 `data:image/svg+xml`（index.html:11） | 渐变方块 + 6 节点 hub 图形 | 无 |
| 外链文档 | 9 条 `bytedance.larkoffice.com` / `bytedance.sg.larkoffice.com`（data.js:48-56、sop-data.js:44） | 仅作为“参考与口径/详情”链接，点击新窗口打开 | 需登录，非 API |
| JS/CDN | **无** | 没有 jQuery/React/ECharts/图表库；所有交互原生实现 | — |
| 图片 | **无**（`thumbnail.png` 仅在仓库里，页面未引用） | — | — |

### 5.4 `tailwind.css`：手写子集，不是完整构建

文件头注释即说明：“AI Factory 生产由构建期编译 tailwind.css；妙搭原型为 buildless，这里只补齐外壳实际用到的少量工具类”（L1-5）。共 42 行 / 37 条规则 / 37 个类，全部是：

```
min-h-screen flex inline-flex items-center justify-center justify-between flex-1 shrink-0
min-w-0 ml-auto ml-2 ml-3 gap-2 gap-2.5 gap-3 gap-6 h-14 h-6 h-8 w-8 w-px w-[210px]
px-2 px-3 px-5 py-4 p-5 sticky top-0 z-40 border-b border-r rounded-lg leading-tight
text-white space-y-4 space-y-5
```

其中 `inline-flex`、`justify-between`、`ml-2` **在 HTML/JS 中没有使用**；`space-y-4/5` 只用于 `#main` 与 `.cmp` 容器；`w-[210px]` 只用于侧栏。结论：**必须保留这 37 条规则**（或用真正的 Tailwind 重新生成等价类），不能假设“Tailwind 已全量可用”——`grid`、`hidden`、`text-sm` 等常见类在这里都**不存在**，但 `design-system.css` 里另有同名工具类（如 `.flex` 在 design-system.css 也有定义），两文件存在重叠定义。

### 5.5 图标系统：Material Symbols 连字 + 内联 SVG 两套

- 内容区图标走**图标字体连字**：`.mat { font-family:"Material Symbols Outlined"; font-size:18px; ... font-feature-settings:'liga' }`（design-system.css:179-183）；`.mat-sm` 16px、`.mat-lg` 22px、`.mat.filled` 用 `font-variation-settings:"FILL" 1,"wght" 500`（L205-207）。
- 实际用到的连字约 35 个、约 90 处：`search`(8)、`chevron_right`(8)、`add`(8)、`close`(7)、`open_in_new`(5)、`expand_more`(4)、`info`(3)、`pending_actions`(2)、`history`(2)、`event_upcoming`(2)、`download`(2)、`chevron_left`(2)、`arrow_forward`(2)、`warning`、`sync`、`search_off`、`save`、`notifications`、`memory`、`hub`、`how_to_reg`、`foundation`、`flag`、`edit`、`domain`、`dns`、`description`、`delete`、`check`、`auto_awesome`、`task_alt`、`error`、`error_outline`、`unfold_more`、`unfold_less`。
- **图标就绪状态是写死的**：`<body class="app-icons-ready">`（index.html:20），没有任何脚本检测字体是否加载成功，也没有移除/添加该类；design-system.css:184-203 准备了 `body.app-icons-failed` 的降级样式（用 `•` 代替），但**永远不会被触发**。
- 侧栏图标**不用字体**，用 `compute-nav-icons.js` 的 25 个内联 SVG path（`computeNavIcon()` 输出 `<svg class="csys-nav-icon">`），因此字体挂了侧栏图标仍可见。
- 顶栏品牌块用连字 `hub`（`.mat.filled`），是页面唯一“实心”图标。

### 5.6 页面专属外观类（决定“像不像”的关键）

| 类 | 作用 | 定义 |
|---|---|---|
| `.app-header` / `.app-sidebar` / `.sidebar-item(.active)` | 顶栏底色、侧栏 210px、导航项的选中态（主色浅底 + 主色文字） | design-system.css:146、149、352-357 |
| `.csys-shell` / `.csys-shell-head` / `.csys-section` / `.csys-kpi*` | 页壳留白 14px、卡片圆角 10px、KPI 条四列 | design-system.css:474-520、785-800 |
| `.chip(-ok/-warn/-err/-info/-violet/-neutral)` | 全站状态胶囊 | design-system.css:276-284 |
| `.filterbar` / `.selwrap` / `.flab` / `.filt` | 筛选条排布与下拉外观 | design-system.css:435-460 |
| `.rb-phase-grid` / `.rb-phase-card(.tone-*)` | 机房三态概览卡（27px 数字、顶部 3px 色条、active 变色） | hierarchy.css:12-23 |
| `.rb-timeline-scroll` / `.rb-tl-header` / `.rb-tl-row` / `.rb-tl-bar(.tone-*)` / `.rb-tl-today` | 机房时间线：240px 标签列 + 140px 结束列、粘性表头、12px 条、菱形里程碑、今日线 | hierarchy.css:24-50 |
| `.rb-stage-track` / `.rb-stage-seg.st-*` | 机房行内 6 段阶段轨（6px 高，按状态变色） | room-buildout.css:344-360 |
| `.rb-room-group` / `.rb-room-row` | 机房清单行（可横向滚动的信息行） | hierarchy.css:46-52 |
| `.rb-env-wrap` / `.rb-env-grid` / `.rb-env-block.st-*` | 环境项方块（148px 网格、skip 用斜纹） | room-buildout.css:372-405 |
| `.rb-stage-card` / `.rb-stage-pill.st-*` | 抽屉内 6 张阶段卡（左侧 3px 状态色边） | room-buildout.css:484-500 |
| `.rb-sp-*` | 二级阶段登记面板（状态按钮 42px 高、表单两列） | room-buildout.css:503-549 |
| `.rb-modal-*` / `.rb-form-*` | 登记弹窗（600px、两列表单、分区 fieldset） | room-buildout.css:414-450 |
| `.cd-summary-cards` / `.cd-summary-card.past/.present/.future` | CD 三态卡（大数字 34px、底部指标行） | cluster-delivery.css:6-24 |
| `.cd-tl-frame` / `.cd-tl-head` / `.cd-tl-body` / `.cd-tl-grid` / `.cd-tl-today` | CD 时间轴框架、24 列网格、今日线 | cluster-delivery.css:57-116 |
| `.cd-tl-bar.past/.present/.future` / `.cd-tl-bar-risk` | 条带三色 + 右侧风险点 | cluster-delivery.css:92-110 |
| `.cd-cluster-row` / `.cd-cluster-head` / `.cd-steps` / `.cd-step` | 9 列集群清单、阶段步骤环（✓/当前/序号） | cluster-delivery.css:117-161 |
| `.cd-stage-acc` / `.cd-sub-item` / `.cd-stage-edit-panel` | 抽屉内阶段手风琴与子项编辑 | cluster-delivery.css:222-284 |
| `.cd-form*` | CD 登记表单（两列、错误块、提示） | cluster-delivery.css:191-204 |
| `.cd-toast` | 底部居中黑色 Toast | cluster-delivery.css:299-301 |

### 5.7 尺寸、层级与断点

| 项 | 值 | 来源 |
|---|---|---|
| 顶栏 | 56px（`.h-14` / `--app-header-height`），`position:sticky; z-index:40` | index.html:24-25；tailwind.css:22/33-35 |
| 侧栏 | 210px（`w-[210px]`），`px-3 py-4`，`overflow` 自定义滚动条 | index.html:63；design-system.css:149 |
| 主区 | `flex-1 min-w-0 p-5`（20px） | index.html:70 |
| 机房抽屉 | `min(1040px,96vw)`，`position:fixed; right:0`，`z-index:50`（`.drawer`），遮罩 49 | hierarchy.css:96；design-system.css:2137-2143 |
| 机房二级阶段面板 | `min(600px,52vw)`，绝对定位在抽屉右侧，`z-index:5` | room-buildout.css:504 |
| 机房登记弹窗 | `min(600px,100vw-32px)`，`z-index:1000` | room-buildout.css:415/438 |
| CD 抽屉 | 540px，`z-index:1395`，遮罩 1394 | cluster-delivery.css:208-209 |
| CD 子抽屉（子项编辑） | 420px，绝对定位在 CD 抽屉内，`z-index:21` | cluster-delivery.css:288 |
| CD 清单 | `min-width:1180px`，横向滚动 | cluster-delivery.css:121 |
| CD 时间轴列宽 | `--tl-label:232px`、`--tl-date:96px` | cluster-delivery.css:57 |
| CD Toast | `position:fixed; bottom:32px; z-index:9999` | cluster-delivery.css:300 |
| 断点 | `@media (max-width:760px)`（机房行/工具栏）、`560px`（弹窗表单）、`900px`/`720px`（CD 时间轴/卡片）、`design-system.css:168/380/414`（900/640/480px） | 各文件 |

### 5.8 样式层里的“死代码”与缺失类

- **整份未加载**：`cluster-delivery-v1.css`（25 KB）。
- `room-buildout.css` 中含大量旧版类，HTML/JS 不引用：`rb-quickbar*`、`rb-status-chip*`、`rb-board*`、`rb-progress*`、`rb-phase-bars`、`rb-milestone*`、`rb-step*`、`rb-item-*`、`rb-timeline-wrap`、`rb-tl-grid`、`rb-tl-scale`、`rb-cell-note`、`rb-over/rb-under` 等（约 60+ 个）。另有 `#main .csys-shell .csys-table-*` 一整段（L11-38）针对一个已不存在的项目表。
- `hierarchy.css` 中 `rb-push`、`rb-group-children`、`rb-child-caption`、`rb-scope-note` 未使用。
- **用了但没有样式的类**：`.rb-field-hint`（登记弹窗两个日期下方的“时间线起点/终点”，room-buildout.css 无定义，实际只吃到 `.rb-field small` 的默认样式）、`.cd-batch-members`（CD 抽屉“同批集群”容器，无定义）、`.csys-multi-empty`。`.rb-room-summary`（room-buildout.css:204）则是有样式无使用。
- 同一元素两套宽度定义（`.rb-drawer` 720 / `.rb-cluster-drawer` 980 → 1040）说明视觉层经过多轮叠加，重建时应视为“最终生效值”而非“设计意图”。

---

## 6. 状态截图

拍摄条件：Chromium（playwright-core，`--no-sandbox`），视口 **1600×1000**，`deviceScaleFactor=1`，每张截图前清空 `localStorage` 并重新加载（除 19b/19c/19d 为“写入后”状态）。带 `full page` 的是整页；其余是元素截图（抽屉/弹窗），元素高度受视口限制为 1000px，抽屉内部可滚动。

### 6.1 机房建设页（`?view` 缺省）

| 文件 | 内容 | 对应交互 / 备注 |
|---|---|---|
| `01-room-buildout-default-present.png` | **默认态**（full page 1600×2031）：KPI 4 卡、三态卡（8/5/7）、时间线（每阶段预览 2 条 + 今日线）、机房清单（5 行）、页脚基准 | 默认 `state.phase='present'`（app.js:5）；清单 5 行，KPI 20/20/12/3 |
| `02-room-buildout-phase-past.png` | 切到“过去 · 已交付”，8 个机房 | `[data-phase=past]`，URL `?phase=past` |
| `03-room-buildout-phase-future.png` | “未来 · 规划中”，7 个机房 | 含 `kmmh`“排期待确认”行 |
| `04-room-buildout-phase-all.png` | “全部机房”，20 行（page 高 4,071px） | 排序=按关键日期，过去/现在/未来混排 |
| `05-room-buildout-filter-area-overseas.png` | 区域=非中 | `[data-filter=area]` |
| `06-room-buildout-filter-type-training.png` | 集群类型=训练 | 父机房保留、子集群收窄，行内显示“当前筛选子集群” |
| `07-room-buildout-search-wlby.png` | 搜索 `wlby`：1 个机房、时间线轴缩成 2 个月 | 见 §4.4；与 01 对比可看出轴变化 |
| `08-room-buildout-search-empty.png` | **搜索无结果空态**：“当前筛选下没有机房”+ 重置按钮 | `hierarchy-view.js:68` |
| `09-room-buildout-sort-owner.png` | 排序=按负责人，20 行 | `[data-sort=owner]` |
| `10-room-buildout-timeline-expanded.png` | 时间线展开（元素截图 1320×1349） | 每组全部展开、标题不再有“预览 2 个” |
| `10b-room-buildout-timeline-expanded-full.png` | 同上整页（1600×4952） | 展开后页面极长，注意滚动性能 |
| `11-drawer-room-overview.png` | **机房详情抽屉 · 机房概览**（悉尼 syd2a）：左导航 4 个集群、概览 facts、6 张阶段卡、下一步 | 1040px 抽屉；`11` 是默认打开的“现在”列表首行 |
| `12-drawer-stage1-confirm-room-info.png` | 阶段 1「确认机房信息」登记面板：9 个字段 + 阶段状态 + 阶段登记 | 600px 二级面板覆盖右侧 |
| `13-drawer-stage2-budget-3v.png` | 阶段 2「机房预算提交 & 3V创建」 | 3 个子项 |
| `14-drawer-stage3-ko.png` | 阶段 3「机房 KO」 | 2 个日期子项 |
| `15-drawer-stage4-deploy-env-items.png` | **阶段 4「机房部署」+ 13 个环境项方块**（syd2a：待处理 7 / 进行中 1 / 已完成 4 / 不适用 1） | 环境项按 Basic/域名/其他/故障链路/Karl 分组；skip 斜纹 |
| `15b-drawer-stage4-env-panel-only.png` | 阶段 4 面板单独一截（600×1000） | 便于看环境项网格与建议文案 |
| `16-drawer-stage5-room-check.png` | 阶段 5「机房检查」（check + date） | — |
| `17-drawer-stage6-complete.png` | 阶段 6「完成」（date + check） | — |
| `18-drawer-add-cluster-form.png` | **登记集群表单**（机房抽屉内）：名称/VDC/集群组/类型/业务方/负责人/预计启动/预计交付 + 校验提示位 | “机房内集群 → 登记” |
| `18b-drawer-cluster-detail.png` | 抽屉内集群详情（只读六阶段 + 子项折叠） | `data-detail-cluster` |
| `19-request-modal-filled.png` | **登记机房建设需求 · 已填写**（600×918）：11 字段全填 | 日期显示为 `MM/DD/YYYY`（见 §7-D28） |
| `19b-room-buildout-after-request-saved.png` | 提交后的页面（21 个机房、KPI 21） | full page 4207px；`phase` 被置为 all |
| `19c-drawer-request-room.png` | 需求登记机房的抽屉：区域/业务方/各 PoC/计划集群 + “删除登记” | 行上“需求登记”chip、规划中徽标 |
| `19d-drawer-request-stage1-filled.png` | 该机房阶段 1：3 个字段显示 `is-filled` | 证明 `fields` 从 localStorage 回填 |
| `20-room-sources-drawer.png` | **参考与口径**抽屉：范围与层级 / 阶段与进度 / 计划数量与筛选 / 来源与新鲜度 / 示例数据与缺口 + 9 条资料 | `Details.sources()`；注意其中“3 环节完成数”与 6 阶段矛盾 |
| `34-drawer-room-overview-blocked-wlby.png` | 有阻塞的机房（Seed WLBY）概览 | 阻塞徽标、阻塞文案、集群交付 2/6 |
| `35-drawer-stage4-env-panel-wlby.png` | WLBY 的阶段 4 环境项（13 项分布与 syd2a 不同） | 对照 15 |

### 6.2 集群交付页（`?view=cluster-delivery`）

| 文件 | 内容 | 对应交互 / 备注 |
|---|---|---|
| `21-cluster-delivery-default.png` | **默认态**（full page 1600×3997）：三态卡 10/8/12、来源分段 30/9/21、时间轴 3 组各预览 2 条、集群清单 30 行 | 默认无筛选 |
| `22-cluster-delivery-timeline-expanded.png` | 时间轴展开（元素 1320×1561） | `[data-cd-expand]` |
| `22b-cluster-delivery-timeline-expanded-full.png` | 同上整页（1600×5061） | 30 行条带全显 |
| `23-cluster-delivery-source-new-first.png` | 交付来源=新机房首批（9 个） | 分段按钮；KPI/清单联动 |
| `24-cluster-delivery-source-existing-add.png` | 交付来源=存量机房扩容（21 个） | — |
| `25-cluster-delivery-cluster-drawer.png` | **集群详情抽屉**（panda-wlby）：状态/来源徽标、来源说明、4 格指标、风险 callout、阶段与子项、下一步 | 540px 抽屉 |
| `26-cluster-delivery-drawer-stages-expanded.png` | 抽屉内 6 个阶段全部展开 | 手动把 `<details>` 全部 open，用于审阅完整结构 |
| `26b-cluster-delivery-stage-edit-panel.png` | **阶段编辑面板**：状态下拉 + 保存/取消 | `[data-cd-stage-edit]`（当前阶段） |
| `27-cluster-delivery-subitem-editor.png` | **子项编辑器**（人工补齐 / 退出码配置）：完成说明 + 标记完成 | 420px 子抽屉 |
| `31-cd-subitem-editor-scene.png` | **子项编辑器（确认需求 / 业务场景）**：6 个字段（业务场景、集群组、project 类型、方向、copy 标杆集群、nodelevel） | 唯一带下拉与标杆集群选择的编辑器 |
| `32-cluster-delivery-cluster-drawer-future.png` | 规划中集群的抽屉（wuhan-train-b1-c1，未启动） | 阶段全部“待开始”，耗时为“—” |
| `28-cluster-delivery-register-form.png` | **登记集群建设需求**表单（11 字段，默认 hhdh / 训练 / new-first / 2026-10-21→2027-01-19 / 杨明磊 / SLA 30） | 与机房页的登记弹窗是**两套不同表单** |
| `29-cluster-delivery-search-empty.png` | **CD 搜索无结果**：时间轴空态“当前筛选下没有集群数据”+ 清单空态“当前筛选下没有集群” | 两个空态同时出现，KPI 变 0 |
| `30-cluster-delivery-page-help.png` | **页面说明抽屉**（440×944）：用途/分析重点/4 条阅读路径/数据边界 | 仅 CD 页有 |
| `33-cluster-delivery-filter-type-inference.png` | 类型=推理 | 清单 11 行；注意来源分段仍是 30/9/21 |

### 6.3 截图未覆盖 / 不存在的状态

- **“批次/集群 switch”**：代码中不存在，无法截图。最接近的控件是“交付来源”三段（`23/24`）；旧版 v1 的“批次抽屉”也未加载。若要 1:1 重建，需明确这是**需求方记忆中的旧版**还是**新需求**。
- 机房页“登记弹窗的校验错误态”“CD 表单的报错态”未单独截图（错误文本见 §3.3/§3.5 与 §7-D27）。
- 抽屉内 1000px 以下的内容（如阶段 4 的业务集群列表、CD 抽屉的“同批集群”）在元素截图中被裁掉；需要时可在浏览器内滚动后补拍。
- 暗色主题、`data-app-site="boe"` 品牌、移动端布局：页面没有入口，未截图。

---

## 7. 缺陷与不一致

按“重建时必须先裁决”的程度排序。编号 `D1…D40`，均可在代码或截图中复核。

### P0 · 会破坏数据/逻辑

**D1 把任意一个阶段标为“已完成”，会把机房进度打回 0，机房跳到“未来”。**
证据：`cluster-model.js:20-27` 的 `current` 循环读的是**原始 `stageStatus` map**（`stages[i]`）而不是派生状态，未登记的阶段一律 `undefined` → 第一个未登记阶段即 `current=0`；`buildout-actions.js:25` 用它回写 `room.stage`。实测：悉尼 syd2a（stage 4）→ 阶段 4「机房部署」标“已完成” → `room.stage=0`，机房从“现在·建设中”变成“未来·规划中”，从默认列表消失；抽屉里同时出现“阶段 4 已完成、阶段 5/6 待处理、阶段 1 进行中”的错乱。登记机房走同一条路径（`buildout-actions.js:21`），同样会归零。截图：`01`（改前）vs 复现时 DOM 状态（未截图，见 §9 复现脚本）。
**必须裁决**：阶段进度是否允许乱序完成；若允许，`stage` 应取“最大连续完成序号”还是“已完成数量”。

**D2 演示机房的编辑只存内存，刷新即丢；用户登记的机房却持久化。**
证据：`buildout-actions.js:1` 注释与 L22-27（非 `userRequest` 分支直接改对象，不写 Store）；`buildout-store.js:80` 只暴露机房/集群的 localStorage 读写。实测：把 syd2a 的阶段改成“已完成”、环境项循环 3 次，`localStorage` 仍为空；刷新后恢复。**但**在同一个抽屉里“登记集群”却会写 `room-buildout-clusters-v1` 并在刷新后保留 —— 同一个抽屉里两种持久化语义。
**必须裁决**：演示数据是否也应可编辑并持久化；还是所有编辑都只对“登记对象”开放（UI 需明确禁用演示对象的编辑）。

**D3 集群交付页的所有写入都不持久化，而且直接修改全局数据集。**
证据：`cluster-delivery-view.js:809` `D.clusters.push(cluster)`；阶段/子项改动写到模块内 `clusterState` Map（L15、L112-124），**没有任何 localStorage 代码**。表单提示写“仅保存在当前浏览器会话，刷新后恢复示例数据”（L771），Toast 却写“已登记…同步到供给时间轴与集群清单”（L816），页面说明又写“会话内有效”（L988）。
**必须裁决**：登记集群是否要跨刷新保留；若要，key 与 schema 需与机房页的两把 key 统一还是分开。

**D4 阶段“实际天数”是假的：已完阶段直接复用计划天数。**
证据：`cluster-delivery-view.js:452` `actualDays = Math.max(1, Math.round(planDays))`；`slip` 字段在数据中从未定义。因此手风琴里“实际 8 天 · 基线 8 天”永远相等，“阶段超基线”只可能由当前阶段的 `stageDays` 触发。截图 `26`。

### P1 · 数字与口径矛盾

**D5 README 说“三阶段 SOP”，实现是六阶段；参考与口径里还留着“3 环节完成数”。**
证据：`README.md:5`“三阶段 SOP”；`README.md:9` 又说“集群六阶段”；`detail-view.js:192`“机房的 3 环节完成数、集群的 6 环节完成数”；而 `app.js:49`、`hierarchy-view.js:48`、`detail-view.js:53` 都是六阶段。截图 `20`。

**D6 `npm test` 跑不起来。**
证据：`README.md:12` 写 `npm test`，`package.json` 没有 `scripts` 字段；实测 `npm test` → `Missing script: "test"`。单测本身可用 `node --test cluster-model.test.mjs` 跑，8/8 通过。

**D7 “已交付集群 12”与“过去 · 已交付机房”卡片的“7 集群已交付”对不上。**
证据：KPI 用 `totals(scoped).delivered`（全部阶段求和，`cluster-model.js:77-83`）= 12；三态卡只统计“过去”分组的机房（`hierarchy-view.js:83`）= 7（yx 的 7 个）。另外 2 个已交付在 wlby（present）、3 个在 syd2a（present）。截图 `01`。

**D8 “阻塞集群 3 / 2 个集群正在建设”，但在建集群实际是 5 个。**
证据：`clusterStatus` 把“有阻塞”与“在建”做成互斥枚举（`cluster-model.js:6`），KPI 的 `building` 只统计无阻塞者（2），`blocked` 单独 3；KPI 明细文案“2 个集群正在建设 · 示例”（`app.js:17`）会让读者以为只有 2 个在建。

**D9 “新建机房 20 个 / 已录入集群 20 个 / 17 个机房计划总数待确认”三个数字撞在一起。**
证据：机房 20（`data.js`）、集群 20（`data.js`）恰好相同；`已录入集群` 卡片的副文案讲的是**机房**维度（`app.js:15` `t.unplannedRooms`），语义混层。截图中 20/20/17 并排，极易被理解为“20 个机房里有 17 个没有集群”。

**D10 集群交付页 30 个集群里有 22 个是批次投影，且存在同名集群。**
证据：`allClusters()` 合成逻辑（L71-107）用 `${site.code}-${typeSlug}-${n}` 命名，`wuhan-train-b1` 与 `wuhan-train-b2` 各出 2 个 → 清单出现两条 `wuhan-train-1`、两条 `wuhan-train-2`；id 不同、名字相同，行无法区分（实测 30 行中有 2 对重名）。截图 `21`。

**D11 两套数据集对同一机房给出不同事实（§2.12）。**
最刺眼的三处：`hhdh` 机房页 0 集群 / 交付页 3 集群；`wuhan` 目标 2026-12-31 vs 验收 2027-02-28；`wlby` 计划 6 个 vs 实际渲染 9 个。**没有任何字段能把两侧记录关联起来**（集群 id 交集为 0）。

**D12 集群交付页的 SLA 是常量 30 天，“超 SLA”因此没有信息量。**
证据：`SLA_DAYS = 30`（L9），显式/合成集群都回落 30（L65/98）；于是 54 天的历史集群显示“超24天”、61 天显示“超31天”，而 SLA 语义本应由每个集群自己的承诺决定。机房页反而有每集群 3/4 天的 `slaDays`。

**D13 阶段计划与批次窗口算术不自洽（hhdh）。**
证据：`hhdh-train-01/02` 的 `stagePlan` 合计 47 天，窗口 2026-10-09→2026-12-20 是 72 天，手风琴里六阶段计划结束于 11-25，比目标早 25 天；其余 6 条显式集群都恰好相等。

**D14 “交付来源”分段上的数字不随筛选变化。**
证据：`sourceCounts()` 用未过滤的 `allClusters()`（L145-152）；筛选“类型=推理”后清单 11 行，分段仍显示 30/9/21（实测）。截图 `33`。

### P2 · 交互死路与体验缺陷

**D15 在收起的阶段上点“编辑阶段”，面板被渲染进折叠的 `<details>` 里，视觉上毫无反应。**
证据：编辑面板在 `.cd-stage-acc-body` 内（L513），点 `[data-cd-stage-edit]` 只把 `panel.hidden=false`（L540-544），不会展开 `<details>`；实测 6 个 details 的 open 状态不变、panel 已 `hidden=false` 但不可见。

**D16 已交付集群 / 已完成阶段的子项点了只弹 Toast，永远打不开。**
证据：`openSubEditor` 的两处提前 return（L638-639）：`state==='past'` → “已交付集群的子项已全部完成”；`stageIndex < cluster.stageIndex` → “该阶段已完成”。而阶段手风琴对**所有**非 past 集群都渲染子项按钮（L512），用户会持续点到死路。

**D17 “TCE Checklist”是链接子项，但点开是备注编辑器，不是链接。**
证据：数据里 `{key:'checklist', name:'TCE Checklist', link:true}`（`cluster-delivery-data.js:52`）；`subItemHTML` 只是加了 `open_in_new` 图标（L476-478），点击仍走 `openSubEditor`（备注 textarea）。旧版 v1 用的是 `data-cd-toast` 提示（v1:297），现行版连提示都没有。

**D18 新增集群永远是“规划中 / 未来”，即使填了过去的日期；且没有 SLA。**
证据：`buildout-store.js:50` `phase: req.target ? 'future' : 'future'`（两个分支相同，明显是遗留）；`toCluster` 不写 `slaDays/actualDays`，详情显示“SLA（示例）—”。实测 `训练集群X`（2026-11-01→2026-12-01）在抽屉里是“规划中”，进不了“现在”。

**D19 机房详情里不能推进集群阶段，尽管 Store 有对应函数。**
证据：`buildout-store.js:62-66` 的 `setClusterStage` 与 `removeCluster` **无任何调用方**；集群详情只渲染 `<details>` 规范文案（`detail-view.js:37-42`）。用户能登记集群，却不能登记它的阶段。

**D20 同一个“机房 PoC”存在两个真相。**
证据：抽屉 facts 读 `room.poc`（`detail-view.js:46`），阶段 1 的“机房 PoC”输入写 `room.fields['poc-room']`（`sop-data.js:10` + `stageField`）。演示机房里改阶段 1 的 PoC，概览不变；只有需求登记机房的 facts 才读 `fields`。

**D21 机房集群计划数不随新增集群更新。**
证据：`roomSummary.planned = room.planCount`（不因新增而变，`cluster-model.js:62`）；syd2a 计划 4、已录入 4，新增 1 个后仍显示“3 / 4 已交付”，而集群导航显示 5 个。实测。

**D22 标记机房阶段完成后，列表仍显示“当前：阶段名 · 进行中”之类的旧状态组合。**
属于 D1 的表现之一：阶段卡状态由 `roomStageStatus` 派生，与 `stage` 回写后的值不同步时会出现“已完成”排在“待处理”之前。截图/复现见 §9。

**D23 搜索命中了技术字段。**
证据：`textMatch` 把对象所有字符串/数组值拼起来匹配（`cluster-model.js:55`），包括 `org:'internal'`、`action:'build'`、`phase`、`source`。实测搜索 `build` 或 `internal` 命中全部（在“过去”筛选下 8/8），用户会以为搜索坏了。

**D24 机房时间线的月份轴随筛选缩放，条带位置会“跳”。**
证据：`timelineMonths(scoped)`（`cluster-model.js:84-90`）用当前筛选结果求 min/max；搜索 `wlby` 后轴从 18 个月变 2 个月（2026/09–2026/10）。对照截图 `01` 与 `07`。CD 页则是固定 24 个月。

**D25 筛选不进 URL，刷新即丢；CD 页连 phase 都没有 URL。**
证据：`app.js:9` 只写 `phase`；`cluster-delivery-view.js` 完全不碰 URL。分享链接只能分享阶段。

**D26 “重置”把阶段重置成“全部”，而默认是“现在”。**
证据：`app.js:24` `Object.assign(state,{phase:'all',...})`；默认值在 L5 是 `'present'`。刷新后回到 present，点重置变 all，行为不一致。

**D27 空名称提交没有自定义错误提示。**
证据：`name` 输入带 `required`（`app.js:29`），浏览器原生校验会阻止 submit，`app.js:36` 的自定义错误分支永远走不到；实测点击提交后 `#rb-request-error` 仍为空且隐藏。只有重名分支能看到文案（“已存在同名机房 / 需求登记”）。

**D28 日期输入在中文页面里显示 `MM/DD/YYYY`。**
证据：`<input type="date">` 使用浏览器 locale；截图 `19` 显示 `11/15/2026`。页面 `<html lang="zh-CN">` 但没有设置 `lang` 相关日期格式能力，无法用 CSS 改。

**D29 CD 每次重渲染都把焦点抢到“展开完整时间线”按钮。**
证据：`renderTimeline` 末尾 `expandBtn.focus({preventScroll:true})`（L308-309）；改筛选、切来源都会触发，键盘用户焦点被夺走。

**D30 “保存登记”按钮不保存，只关闭面板；字段是 change 时静默保存。**
证据：`detail-view.js:122` 的按钮带 `data-stage-panel-close`，点击走 L157 只把 `stagePanel=-1`。用户会以为没点保存就丢了，或以为点了才保存。

**D31 机房页没有“页面说明”，CD 页有。**
证据：`app.js:49` 未传 `guidance`，`computePageShell` 因此不渲染帮助按钮（`compute-ui-kit.js:66-68`）；CD 页传了（L981-991）。两页的信息可达性不一致。

**D32 环境项数量文案写死 13，自定义项后不复数。**
证据：`sop-data.js:31`“确认 13 个环境项均已完成或显式 skip”；自定义环境项会增加实际数量（`detail-view.js:13`），阶段 4 的计数会变，但阶段 5 的检查文案不变。

### P3 · 资产与工程卫生

**D33 mock 徽标与实际能力相反。** `navigation.js:30` 给“机房建设”打 `mock`，`navigation.js:29`“集群交付”不打；但机房页功能更多（登记、阶段、环境项、集群登记）。12 个 `mock` 徽标里只有这一个可点。

**D34 25 个导航项里 23 个禁用、顶栏 5 个控件全禁用。** `navigation.js:69-77`、`app.js:69`。用户头像也禁用，没有任何用户菜单 DOM。

**D35 死代码。** `cluster-delivery-view-v1.js/.css` 整份未加载；`Store.setClusterStage/removeCluster/hasCluster`、`BUILDOUT_ACTIONS.setStage`、`data.sla`、`detail-view.sourceMode`、`compute-ui-kit` 的表格/Tab/筛选套件均无调用；`room-buildout.css` 约 60 个类无引用（§5.8）。

**D36 缺失样式类。** `.rb-field-hint`、`.cd-batch-members` 在 CSS 中没有定义（§5.8）；`.rb-room-summary` 有样式无使用。

**D37 图标字体无运行时降级。** `app-icons-ready` 写死在 `<body>`（index.html:20），`app-icons-failed` 降级样式永远不会生效；字体来自外网，断网时图标全空。

**D38 重复/失效的宽度定义。** `.rb-drawer` 720 → `.rb-cluster-drawer` 980 → 1040，最终值只能靠“后加载覆盖”推断（§5.1）。

**D39 表单元数据三套类型枚举。** 机房页筛选 4 类（通用/训练/推理/微服务）、机房内登记 5 类（训练/推理/存储/通用/控制面）、CD 登记 4 类（训练/推理/通用 / 微服务/弹性池）。新增“存储/控制面”集群后，筛选下拉里不会出现该类型（选项在初始化时从现有数据去重，`app.js:8`）。

**D40 机房页 `phase` 字段与派生相位可能脱节。** 目前数据一致，但任何 stage 修改（D1）都会让 `phase` 与显示相位不一致；该字段既未用于渲染，也未在编辑时同步。

---

## 8. 重建所需的后端能力清单

> 只列“UI 已经存在的行为”所隐含的读写能力，以及 UI 依赖但当前数据里没有的字段。不涉及技术选型。

### 8.1 写路径 → 隐含的 API 操作

| # | UI 入口 | 写入的数据 | 现有载体 | 隐含操作（语义） | 备注 / 陷阱 |
|---|---|---|---|---|---|
| W1 | 登记机房建设需求 → 提交 | `{name, area, fields{ko-plan, gpu-arrival, deploy-estimate, poc-*, business-side}, createdAt}` | localStorage `room-buildout-requests-v2` | `POST /rooms`（创建草稿机房 + 阶段 1 字段） | 名称唯一（全局，含演示数据）；创建后 `phase=future`、`stage=0`；无“草稿/提交”状态区分 |
| W2 | 阶段状态 4 按钮 | `stageStatus[i] ∈ {todo,doing,done,skip}`，并回写 `stage` | 演示：内存；登记：同一 localStorage 记录 | `PUT /rooms/:id/stages/:i/status` | **服务端必须重新计算 `stage`**，且要解决 D1 的语义；`todo` 在本地实现为“删除该键”，等价于“未登记”，与显式 todo 不可区分 |
| W3 | 子项输入（date/person/text） | `fields[itemId] = string` | 同上 | `PUT /rooms/:id/stages/:i/items/:itemId` | 空值 = 删除键；没有“谁在何时改的” |
| W4 | 勾选子项 | `fields[id] = '1' \| ''` | 同上 | 同上（布尔语义） | 用字符串 `'1'` 表示 true |
| W5 | 阶段登记（负责人/计划/完成/备注） | `stageMeta[i] = {owner, plan, done, note}` | 同上 | `PUT /rooms/:id/stages/:i/meta` | 备注 textarea 也是 change 时保存 |
| W6 | 环境项方块循环 | `envStatus[itemId] ∈ {pending,doing,done,skip}` | 同上 | `PUT /rooms/:id/env/:itemId`（建议直接 SET，而不是 CYCLE） | 当前是客户端算下一态；并发/重放下会漂移 |
| W7 | 添加自定义环境项 | `customEnv += {id,name,category,scenes[]}` | 同上 | `POST /rooms/:id/env-items` | name 必填但无错误提示；category/scene 有默认值；自定义项 id 由客户端生成 |
| W8 | 登记集群（机房内） | `{roomId,name,vdc,group,type,tenant,owner,start,target,stage:0}` | localStorage `room-buildout-clusters-v1` | `POST /rooms/:id/clusters` | 同机房内名称唯一；**集群记录与“是否需求登记机房”无关**（演示机房也可加）；`phase` 恒 future（D18） |
| W9 | 删除登记 | 删除 `name/fields/...` 整条 | 同上（仅 requests key） | `DELETE /rooms/:id` | **不会删除该机房下的集群**（`buildout-actions.js:96-99` 只调 `Store.remove`），会留下 `roomId` 指向不存在机房的孤儿集群；删除前无二次确认 |
| W10 | CD 阶段编辑（保存） | `{stageIndex, subIndex, stageDays, state, end, next}` | **内存**（`clusterState`） | `PUT /clusters/:id/stage` | 语义：done → `stageIndex+1`；全完成 → `state=past, end=asOf`；doing → 清空该阶段子项完成标记；服务端需同一套规则 |
| W11 | CD 子项“标记完成” | `subDone[stage:sub]=true` + `subItemData[stage:sub]={字段}` | 内存 | `PUT /clusters/:id/stages/:i/items/:j` | 全部子项完成时自动推进阶段；`scene` 子项有 6 个业务字段（业务场景/集群组/project 类型/方向/copy 标杆/nodelevel），其余子项只有一段“完成说明” |
| W12 | CD 登记集群 | `{siteId,name,group,business,type,origin,start,end,owner,slaDays,note}` | 内存（push 进 `D.clusters`） | `POST /clusters` | 名称全局唯一（含合成集群）；`end>start`；默认值见 §3.5 |
| W13 | CD 导出 | 无写入 | — | `GET /clusters/export?area&kind&type&source&q`（或在客户端由已加载数据生成） | 当前是**当前筛选结果**的客户端 CSV（14 列、BOM） |
| W14 | 机房页筛选/搜索/排序/展开 | 无写入 | 内存 / URL `phase` | `GET /rooms?area&type&tenant&q&phase&sort` | 当前全部客户端计算；数据量 20/30 无需服务端分页 |
| W15 | CD 筛选/来源/展开 | 无写入 | 内存 | `GET /clusters?area&kind&type&source&q` | 来源分段计数是全局值（D14） |

**UI 里不存在、但数据层已经准备了函数（重建时要么补 UI，要么删能力）**：删除集群（`Store.removeCluster`）、改集群阶段（`Store.setClusterStage`）、判断集群是否存在（`Store.hasCluster`）、直接设置机房阶段（`setStage`，会绕过阶段状态）。均无调用方。

### 8.2 读模型与派生数据

| 读模型 | 需要的原始数据 | 现在的计算位置 | 关键规则 |
|---|---|---|---|
| 机房列表行 | room + 该机房全部 cluster | `cluster-model.js:56-75` | `summary.planned = planCount`（筛选命中子集群时改为 `matched`）；`status` 由 stage 派生；保留父行、子集群收窄 |
| 机房 KPI | 全部 room/cluster | `cluster-model.js:77-83` | rooms / past / present / future / recorded / delivered / blocked / building / planned / unplannedRooms / avgRoomDays |
| 三态概览卡 | 按派生机房相位分组后再 `totals` | `hierarchy-view.js:82-84` | 每台卡的次要指标不同（过去=已交付+平均耗时；现在=在建+阻塞；未来=规划已录入+计划待补充） |
| 机房时间线 | room.ko/target/delivered | `cluster-model.js:84-108` | 轴随筛选重算（D24） |
| 机房详情 facts | room + summary + duration + fields | `detail-view.js:43-53` | 演示机房取 `room.poc/region/...`，登记机房取 `fields`（D20） |
| 机房阶段面板 | SOP 定义 + stageStatus/stageMeta/fields/envStatus/customEnv | `detail-view.js:103-124` | 子项类型决定控件；环境项分组固定顺序 + 动态追加 |
| 集群详情（机房页） | 集群 6 阶段规范 + cluster 字段 | `detail-view.js:55-62` | 只读 |
| CD 三态 KPI | 派生后的 30 个集群 | `cluster-delivery-view.js:155-173` | past 平均耗时、past 机房数、阻塞数、阶段超基线、未来来源拆分 |
| CD 时间轴 | site + batch + cluster + 固定 range | L222-310 | 条带 = 集群；合成规则见 §2.9 |
| CD 清单 | 同上 | L313-373 | 排序：present → past → future，再按 start |
| CD 抽屉 | cluster + stageSchedule + subStatus + 同批集群 | L442-735 | 阶段计划窗口、子项完成判定、`stageOver` |
| CD 子项编辑器的“copy 标杆集群”选项 | 前 8 个 past/present 集群名 | L590-594 | 客户端 slice(0,8)，无搜索 |
| 参考与口径 | `data.sources` + 静态文案 | `detail-view.js:192` | 9 条资料 + 六段说明 |
| CD 页面说明 | 静态文案 | `cluster-delivery-view.js:981-991` | 仅 CD 页 |

### 8.3 必须由服务端或共享领域层保证的一致性

1. **机房阶段进度的定义**（D1）：`stage` 与 `stageStatus` 只能有一个真相；否则列表、时间线、阶段卡会各说各话。
2. **集群状态机**：机房页 `delivered/blocked/building/planned` 与 CD 页 `past/present/future` 是两套状态，重建时若合并，需要映射规则（当前无映射）。
3. **SLA 来源**：机房页每集群 3/4 天，CD 页常量 30 天；同一集群跨页会给出不同结论。
4. **时间基准**：两页 asOf 差 3 天且写死；真实系统应只有一个“今天”。
5. **唯一性约束**：机房名（全局）、机房内集群名（按机房）、CD 集群名（全局，含合成集群）。
6. **删除级联**：删机房是否删集群、删批次是否删集群、删集群是否删子项（当前都没有级联）。
7. **就地修改全局数据**：CD 页把登记集群 push 进导入的数据集；真实系统必须是服务端写入 + 重新拉取。

### 8.4 数据模型缺口（UI 已暗示、数据里没有）

| 缺口 | 被谁需要 | 现状 |
|---|---|---|
| 每阶段的真实开始/完成时间 | CD 阶段“实际 N 天”、机房阶段“计划/完成时间” | 只有 `stageDays`（当前阶段停留天数）与手填的 `stageMeta.plan/done`；已完阶段的 actual 是计划值（D4） |
| 阶段/子项变更历史（谁、何时、从什么改成什么） | 审计、SLA 归因 | 完全没有；`createdAt` 只在登记记录上 |
| 子项的完成时间与完成人 | 子项编辑器只存“完成说明” | 只有 `subDone` 布尔 + 一段自由文本 |
| 环境项的完成时间/责任人 | 机房验收 | 只有四态枚举 |
| 集群与批次的稳定关联 | CD 同批集群、批次计数 | 显式集群有 `batchId`；合成的 22 个只有 `batchId` 反推，无独立记录 |
| 机房与 CD site 的映射 | 跨页一致性 | 仅 5 个 id 字面相同，`hl` 无对应机房（D11） |
| 机房验收/交付记录 | 机房“已交付”状态 | 只有 `delivered` 日期与 `blocker` 文案；没有验收单/附件 |
| skip 的原因 | 环境项“不适用” | 只存 `skip`，无理由字段 |
| 用户与权限 | 顶栏用户、负责人下拉 | 负责人是自由文本（“于子晨”“井诚 / 韩亮”“待确认”），无用户表 |
| 通知/待办 | 顶栏通知、阻塞提醒 | 无 |
| 批次自身的状态机 | CD 批次（20 条）只是聚合容器 | 无批次详情 UI（v1 有，现行版删了） |

### 8.5 规模与非功能事实

- 数据量：20 机房 / 20 集群（机房页）；6 站点 / 20 批次 / 30 集群（CD）。全部一次性渲染，**没有分页、没有虚拟滚动**；CD 清单 `min-width:1180px` 横向滚动，30 行同屏。
- 搜索是每次按键全量重渲染（`app.js:64`、`cluster-delivery-view.js:951`），在 20/30 条数据下无感。
- 无网络请求、无鉴权、无错误边界、无加载态（`ui-kit.js` 的 loading/error 组件未被使用）。
- 外链资料 9 条依赖飞书登录，不能当作数据源。

---

## 9. 附录：复核方式

### 9.1 运行与测试

```bash
# 静态站点（仓库内已有服务在 8890；如需自起）
cd site && python3 -m http.server 8890 --bind 0.0.0.0
# 打开
#   http://127.0.0.1:8890/index.html
#   http://127.0.0.1:8890/index.html?view=cluster-delivery

# 单测（README 里的 npm test 不可用）
cd site && node --test cluster-model.test.mjs     # 8 pass / 0 fail
npm test                                          # Error: Missing script: "test"
```

### 9.2 复现 D1（阶段进度归零）

1. 打开机房页，搜索 `syd2a`，点机房名打开抽屉。
2. 点第 4 张阶段卡「机房部署」→ 点“已完成”。
3. 观察：抽屉阶段卡变为“1 进行中 / 2 待处理 / 3 待处理 / ✓ 已完成 / 5 待处理 / 6 待处理”；关闭抽屉后该机房从“现在”列表消失，三态卡变为“过去 0 / 现在 0 / 未来 1”。
4. 等价断言（控制台）：`BUILDOUT_ACTIONS.findRoom('syd2a').stage === 0`。

### 9.3 截图脚本要点

- 启动：`chromium.launch({executablePath:'/home/yams/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', headless:true, args:['--no-sandbox']})`
- 视口：`{width:1600,height:1000}`，`deviceScaleFactor:1`
- 每次截图前 `localStorage.clear()` + `reload()`（除“写入后”状态）
- 整页：`page.screenshot({fullPage:true})`；抽屉/弹窗：`elementHandle.screenshot()`
- 抽屉内二级面板：先点 `[data-stage-panel="i"]`，截图 `#rb-drawer`；关闭用 `Escape`（`detail-view.js:185` 先关面板）

### 9.4 盘点边界

- 只在 Chromium（headless）+ 1600px 视口验证；Firefox/Safari 的 `<details>`、日期控件、字体渲染未验证。
- 没有后端，因此“后端能力”是根据 UI 行为反推的语义，不是既有接口。
- 时间相关数字以原型写死的 asOf 为准；真实“今天”下的变化见 §4.5。
- 引用行号以本次快照（2026-10-24）为准；文件未做任何修改。

### 9.5 一句话结论

这是一个**视觉完成度很高、数据与持久化严重不完整**的双页原型：机房页有一套自洽（但有 D1 级 bug）的六阶段/环境项/集群登记模型 + localStorage；集群交付页是另一套独立的、由批次投影出 30 个集群的只读展示 + 会话内编辑；两页共享外壳与设计系统，但**不共享数据、不共享阶段定义、不共享时间基准**。重建的第一件事不是写页面，而是裁决 §7 的 P0/P1（尤其 D1/D2/D3/D5/D10/D11）。
