---
name: debugging
description: 系统化调试流程。适用于 Electron 主进程/渲染进程报错、3D 场景不渲染、IPC 不通、类型检查或构建失败、运行时崩溃等问题排查。
---

# 调试

## 什么时候用

- 运行 `pnpm dev` 或 `pnpm build:win` 时出现错误
- 功能行为不符合预期（3D 场景空白、点选无反应、IPC 无响应）
- typecheck/lint 失败但原因不直观

## 通用流程

1. **复现**：确认最小复现步骤；记录报错原文（不要只看摘要）
2. **定位边界**：用二分法缩小范围——是主进程还是渲染进程？是新代码还是既有代码？`git stash` 或注释掉最近改动验证
3. **读源码**：从报错堆栈的入口文件开始读，追踪数据流（渲染进程 → preload → ipcMain → 模块）
4. **修复**：最小改动修复，不顺手重构无关代码
5. **验证**：`pnpm typecheck && pnpm lint`，再 `pnpm dev` 复测原始场景

## 本项目常见问题定位

### 报错类型与入口

- 主进程报错 → `src/main/index.ts` 及其导入的模块；日志在终端
- 渲染进程报错 → DevTools（F12 打开，`optimizer.watchWindowShortcuts` 已启用 F12）
- 打包后报错 → 检查 `out/` 是否与源码同步（先重新 `pnpm build`）

### 高频原因

- **IPC 不通**：preload 的 `index.d.ts` 类型与 `index.ts` 实际暴露不一致；`contextIsolation` 下 API 挂在 `window.electronAPI`，未挂载说明 preload 抛错
- **3D 场景空白**：`three`/`@react-three/fiber` 版本不匹配（文档 r185/fiber ^9/drei ^10 需配套）；Canvas 父容器无高度
- **原生模块报错**：`better-sqlite3` 需要在 `pnpm install` 后由 postinstall 重编；报 ABI 错误时删除 `node_modules` 重新安装
- **找不到模块**：新依赖未安装；或路径用了文档的 `assets/`、`installer/` 等仓库不存在的目录
- **渲染进程拿到 Node API**：检查是否绕过了 contextBridge（不应存在，见 AGENTS.md 架构约束）

## 输出要求

- 说明根因（引用 `文件:行号`）与修复方式
- 修复后必须跑 `pnpm typecheck && pnpm lint` 并复测
- 若无法复现：如实说明，给出排查日志/断点建议，不臆测修复
