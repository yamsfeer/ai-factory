---
id: T3
title: 机房建设页：KPI、三阶段卡、时间线、筛选、机房清单
status: open
blocked-by: [T1, T2]
branch: t3-room-page
---

## Scope
- 统计卡 4 个、过去/现在/未来三卡、时间线（含展开、今天线、里程碑菱形）
- 筛选（区域/类型/业务）、搜索、重置、tab、排序
- 机房清单行：六阶段进度条、负责人、日期、耗时、集群交付进度
- URL 同步筛选与 tab；空态/加载态
- 严格复用原型 class 与 DOM 结构

## Acceptance
- 与 `docs/screenshots/01..10` 并排无版式差异（数据内容除外）
- 筛选/搜索/tab/排序/展开全部可用且刷新后保持
