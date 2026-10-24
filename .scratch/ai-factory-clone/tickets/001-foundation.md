---
id: T1
title: 地基：仓库脚手架、CSS/字体迁移、领域类型、页面外壳
status: done
blocked-by: []
branch: t1-foundation
---

## Scope
- pnpm + TS + Vite + Fastify 工程骨架，单端口生产模式，Vitest/Playwright 配置
- 复制 5 个原型 CSS 与字体自托管；确认 1600px 下 shell 与原图一致
- `shared/`：类型、六阶段定义、环境项模板、推导函数（currentStage/phase/status/duration/timeline）
- Web 外壳：顶栏（品牌 + 操作人 + 全站搜索）、侧栏（交付与准入两项）、路由、PageShell/Section/KpiStrip 组件
- API 客户端与 useApi hook 骨架

## Acceptance
- `pnpm dev` 两条路由可打开，无控制台错误
- 顶栏 / 侧栏 / 页壳截图与原型的对应区域一致（字体、间距、颜色）
- 领域推导单测通过
