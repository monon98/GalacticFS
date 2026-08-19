---
name: typescript
description: 编写或修改 TypeScript/Electron/React 代码时的项目规范。涉及 src/main、src/preload、src/renderer 时使用；涵盖 electron-vite 布局、contextBridge IPC、pnpm 命令、Prettier/ESLint 风格与验证流程。
---

# TypeScript 编码规范

## 什么时候用

- 在 `src/main/`、`src/preload/`、`src/renderer/` 中编写或修改 TS/TSX 代码
- 新增 Electron IPC、React 组件、Three.js 场景代码
- 安装依赖或运行构建/检查命令

## 项目布局

- `src/main/index.ts` — Electron 主进程入口；功能模块按 `docs/GalacticFS.md` §10.2 拆分为独立文件（文件扫描器、托盘、更新器、配置、缩略图缓存）
- `src/preload/index.ts` — contextBridge 暴露 API；所有 IPC 通道必须在 preload 统一封装，渲染进程不得直接使用 Node API
- `src/renderer/src/` — React 应用；用 `@renderer/*` 别名导入（不要用相对路径跨越 `src/renderer/src` 边界）
- 依赖主进程的模块必须是 `better-sqlite3`、`electron-store` 等原生/CJS 模块时，优先在 main 进程使用

## 代码风格（必须遵守）

- 无分号、单引号、`printWidth: 100`、无尾逗号（`.prettierrc.yaml`）
- **必须写中文注释**：
  - 模块文件顶部：JSDoc 风格一句话说明职责与使用方式
  - 公共函数/方法/类：说明参数、返回值、抛出的错误及何时抛
  - 复杂逻辑：解释"为什么"（算法选择、边界条件、非直观行为），不复述代码
  - 测试文件：describe 块或关键用例说明测试意图
  - 避免：逐行翻译式注释、冗余注释、注释掉的死代码
- 文档 `docs/GalacticFS.md` 中的代码片段是 CommonJS/JS 风格，改写为 ESM 风格 TS 后再用，不要直接复制
- 版本选择：文档写的版本（如 electron ^43/44）若装不上，用仓库能干净安装的版本

## 验证流程（提交前必须完成）

```bash
pnpm typecheck        # 主进程 + 渲染进程两个 TS 项目都必须通过
pnpm lint             # eslint --cache .
pnpm format           # 新文件运行 prettier
```

- `pnpm dev` 验证 HMR；`pnpm build:win` 验证打包（会先跑 typecheck）
- 修改 `package.json` 依赖后重新运行 `pnpm install`（postinstall 会重编原生依赖）

## 常见陷阱

- 渲染进程绝不要引入 Node 内置模块或 `electron` 主进程 API
- IPC handler 用 `ipcMain.handle`（invoke/handle 模式），单方向事件用 `webContents.send`
- `window.electronAPI` 的类型声明维护在 `src/preload/index.d.ts`，新增 API 后同步更新
