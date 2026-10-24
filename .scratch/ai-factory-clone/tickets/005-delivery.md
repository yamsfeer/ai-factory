---
id: T5
title: 集群交付页：批次/集群两视图、供给时间线、表格、详情、CSV
status: open
blocked-by: [T1, T2]
branch: t5-delivery
---

## Scope
- 批次视图：机房为行、批次条带、里程碑
- 集群视图：六环节圆点、阻塞、负责人、耗时/SLA、瓶颈
- 视图切换、筛选（区域/机房/类型/状态）、展开完整时间线
- 集群行详情（六阶段逐项勾选、推进）、新建/编辑/删除集群
- 导出当前筛选 CSV

## Acceptance
- 与 `docs/screenshots/19..` 一致
- 推进阶段后状态变已交付；导出文件 Excel 打开不乱码
