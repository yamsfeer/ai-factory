---
id: T4
title: 机房详情抽屉 + 登记机房 Modal + 集群登记
status: open
blocked-by: [T1, T2, T3]
branch: t4-detail
---

## Scope
- 抽屉：机房概览、机房内集群（登记/删除）、六阶段 SOP（展开、子项控件、状态）
- 环境项：13 个方块轮转、自定义增删
- 登记机房 Modal：字段、校验、重名错误、提交后进列表
- 机房编辑/删除；风险提示（机房未完成但集群在建）
- 写操作后的全局刷新与 toast

## Acceptance
- 与 `docs/screenshots/11..18` 一致
- 改完阶段/环境项/子项后刷新仍在；新建机房出现在列表
