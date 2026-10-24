---
id: T6
title: 集成、截图对比修版、E2E、部署到 Tailscale
status: done
blocked-by: [T3, T4, T5]
branch: t6-acceptance
---

## Scope
- 起生产构建，1600px 逐状态截图与原型对比，修版式差异
- Playwright 主路径 e2e 全绿
- 部署为常驻服务（端口 8890 之外另起），通过 Tailscale 打开用户 Mac 浏览器
- 交接说明：启动命令、数据文件位置、重置 seed 方法

## Acceptance
- 两页核心状态无可见版式差异
- e2e 全绿；服务重启数据不丢
- 用户在 Mac 浏览器打开即用
