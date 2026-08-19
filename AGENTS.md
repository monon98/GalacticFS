# AGENTS.md

## 项目状态

- **GalacticFS**：基于 Electron + Three.js + React 的 3D 空间文件浏览器。目录 = 恒星，文件 = 行星。
- 当前代码库仍是**全新的 `electron-vite` TS 模板**（"my-app" 样板代码：`Versions.tsx`、`ping` IPC、electron.svg），GalacticFS 功能尚未实现。
- **`docs/GalacticFS.md` 是权威产品/技术规格文档**（v2.0，2026-08-18）。按它实现功能。文档与代码冲突时：文档决定*功能*，仓库实际的 TS/electron-vite 结构决定*代码组织*。

## 命令（包管理器为 pnpm，不是 npm）

```bash
pnpm install          # 依赖安装（postinstall 已移除，避免无 VS 工具链时 rebuild 失败）
pnpm dev              # electron-vite dev（HMR）
pnpm test             # vitest 单元测试（src/main 下 *.test.ts）
pnpm typecheck        # 同时运行 typecheck:node 和 typecheck:web，两者都必须通过
pnpm lint             # eslint --cache .
pnpm format           # prettier --write .
pnpm build:win        # typecheck + electron-vite build + electron-builder --win (NSIS)
```

- `pnpm dev` 输出分离：main/preload 输出到 `out/`，renderer 由 Vite 提供。
- `.npmrc` 和 `electron-builder.yml` 配置了 **npmmirror 镜像下载 Electron**——有意为之（国内网络），不要删除。
- 原生依赖（better-sqlite3 走 prebuilds 免编译）：本机无 VS Build Tools，**不要**手动跑 node-gyp rebuild；pnpm-workspace.yaml 中 better-sqlite3 的 allowBuilds 为 false，勿改为 true。

## 架构

- `src/main/` — Electron 主进程（入口 `index.ts`）。文档分配了：文件扫描器、托盘、更新器、electron-store 配置、better-sqlite3 缩略图缓存——按 `docs/GalacticFS.md` §10.2 拆分为独立模块。
- `src/preload/index.ts` — 通过 contextBridge 暴露 API；文档计划暴露 `window.electronAPI`（getThumbnail、scanDirectory、get/setConfig、openFile、onSetRootPath）。
- `src/renderer/src/` — React 应用；`@renderer/*` 别名 → `src/renderer/src/*`（见 `electron.vite.config.ts`、`tsconfig.web.json`）。
- 渲染进程必须通过 contextBridge 暴露的 API 访问文件系统/IPC；绝不在渲染进程暴露原始 Node API。

## 待补的技术栈（来自文档 §3.1）

`three`（r185）、`@react-three/fiber` ^9、`@react-three/drei` ^10 —— 需要添加（渲染进程）。已装：electron ^43、react ^19.2、vite ^8、electron-vite ^5、electron-updater、better-sqlite3 ^13（prebuilds）、electron-store ^11、@immich/walkrs 0.0.13（**注意：npm 包无 Windows 二进制**，扫描器当前用 Node fs 实现，walkrs 留作后续接入）。

## 文档与仓库的差异（不要照抄）

- 文档代码片段是 **CommonJS/JS**（`require`、`.js`/`.jsx` 路径）；仓库是 **ESM 风格 TS**（`import`、`src/main/index.ts`、`src/renderer/src/`）。按仓库 TS 风格重写文档片段；忽略文档的 `assets/`、`installer/`、`src/renderer/*.jsx` 路径。
- 文档的 `npm install` 是错的——用 pnpm。
- `electron-builder.yml` 仍是模板身份（`com.electron.app`、`my-app`）；打包时按文档重新品牌化。

## 产品约束（来自文档 §2.4 —— 不可妥协）

- **只读浏览器**：不包含删除、移动、重命名、文件关联功能——明确排除。
- 默认扫描根目录：用户主目录；视觉映射：大小→半径（对数缩放 0.2–3.0）、类型→颜色（图片=绿、视频=蓝、文档=橙、代码=紫、压缩包=红、其他=灰）、最近修改→发光、文件夹=带星环的行星。
- UI 文案为**中文**（例如托盘"打开主窗口/检查更新/退出"、右键菜单"在 GalacticFS 中浏览"）。
- 品牌色：背景 `#0B0C10`、强调 `#45A29E`、高亮 `#FF6B35`、金色 `#F5C842`。

## 代码风格

- Prettier：无分号、单引号、`printWidth: 100`、无尾逗号（`.prettierrc.yaml`）。新文件运行 `pnpm format`。
- **代码必须写注释**（用中文）：
  - 每个模块文件顶部：一句话说明职责与使用方式（JSDoc 风格 `/** */`）
  - 公共函数/方法/类：说明参数、返回值、抛出的错误及何时抛
  - 复杂逻辑（算法、边界条件、非直观行为）：解释"为什么"而非复述代码
  - 测试文件：describe 块或关键用例说明测试意图
  - 避免：逐行翻译式注释、明显冗余注释、注释掉的死代码
- ESLint 为 flat config（`eslint.config.mjs`），使用 `@electron-toolkit` 预设；忽略目录：`node_modules`、`dist`、`out`。
