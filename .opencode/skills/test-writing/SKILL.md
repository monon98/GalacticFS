---
name: test-writing
description: 为本项目编写测试的通用流程。适用于为 Electron 主进程逻辑（扫描器、缩略图缓存、配置）、preload IPC 封装或渲染进程 React/Three.js 组件新增测试。
---

# 测试编写

## 什么时候用

- 新增模块（文件扫描器、缩略图缓存、配置管理、IPC handler）后补测试
- 修复 bug 后添加回归测试
- 修改已有测试代码

## 项目现状

- 测试框架：**vitest**（已配置，`vitest.config.ts`，node 环境），命令 `pnpm test` / `pnpm test:watch`
- 测试文件约定：`src/**/*.test.ts`（随被测模块放置，目前聚焦 `src/main/` 纯逻辑与本地 IO）
- 项目验证命令：`pnpm test && pnpm typecheck && pnpm lint`

## 测试策略

### 主进程逻辑（优先测试的部分）

- 纯逻辑（类型映射、颜色映射、半径计算、路径处理）最容易测，无需 Electron 环境
- `better-sqlite3` 缩略图缓存：用临时目录/内存数据库，测完清理
- `electron-store` 配置：注入临时存储路径
- IPC handler：mock `ipcMain` 或直接调用 handler 函数本身

### 渲染进程

- React 组件（侧边栏、面包屑、选中面板）：react-testing-library
- Three.js 场景：测数据映射与交互状态逻辑，3D 渲染本身不做快照（GPU 环境不稳定）

### 不测的部分

- Electron 窗口生命周期、托盘、安装包行为——手动验证
- 真实文件系统扫描性能——用少量 fixture 目录代替

## 编写要点

- 每个测试文件对应一个被测模块，命名 `*.test.ts`/`*.test.tsx`
- fixture 数据放测试文件旁或 `src/**/__tests__/` 下，不用真实用户目录
- 测试覆盖：正常路径、空输入、错误路径（文件不存在）、边界（0 字节、超大文件）
- 断言错误信息要具体（不要只断言 `rejects.toThrow()` 而不验证信息）

## 验证

```bash
pnpm test && pnpm typecheck && pnpm lint
```

- 测试失败先确认是代码 bug 还是测试本身问题
- 新增测试文件要运行 `pnpm format`，并在 describe/关键用例处用中文注释说明测试意图
