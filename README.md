# GalacticFS

基于 Electron + Three.js + React 的 3D 空间文件浏览器。把文件系统变成一个可漫游的星空：**目录 = 恒星，文件 = 行星**。

> 只读浏览器：不提供删除、移动、重命名等文件操作。

## 特性

- **星空漫游**：行星按螺旋轨道环绕当前目录（中心恒星），可旋转缩放视角、框选多选
- **视觉映射**（文件信息一目了然）：
  - 大小 → 行星半径（对数缩放）
  - 类型 → 行星颜色（图片=绿、视频=蓝、文档=橙、代码=紫、压缩包=红、其他=灰）
  - 最近修改 → 发光强度（1 周内高亮、1 月内正常、更久暗淡）
  - 文件夹 → 带金色星环的行星（金色标签），与文件明显区分
- **动态效果**：行星自转 + 绕恒星公转（每颗速度/相位不同）
- **缩略图**：图片/视频行星使用真实缩略图贴图（SQLite 缓存，mtime 校验）
- **快速扫描**：优先加载一二级目录，第三层文件作为子星系行星可见（深层不递归）
- **交互**：单击选中、双击进入目录/打开文件、右键"在 GalacticFS 中浏览"（Windows）
- **可配置**：默认扫描根目录、显示隐藏文件、忽略的文件夹列表（如 node_modules/.git）
- **系统集成**：托盘菜单（中文）、窗口尺寸记忆、自动更新

## 开发

```bash
pnpm install    # 安装依赖
pnpm dev        # electron-vite dev（HMR）
pnpm test       # vitest 单元测试
pnpm typecheck  # 类型检查（node + web）
pnpm lint       # eslint
pnpm build:win  # 打包 Windows 安装包（NSIS）
```

> 国内网络环境：Electron 二进制与依赖镜像已配置（`.npmrc`、`electron-builder.yml`），请勿删除。

## 技术栈

- Electron 43 + electron-vite（main / preload / renderer 三进程）
- React 19 + TypeScript
- Three.js r185 + @react-three/fiber 9 + @react-three/drei 10
- better-sqlite3（缩略图缓存，prebuilds 免编译）
- electron-store（配置持久化）、electron-updater（自动更新）

## 目录结构

```
src/
├── main/        # 主进程：扫描器、缩略图缓存、配置、IPC、托盘、右键菜单、更新器
├── preload/     # contextBridge 桥接层（window.electronAPI）
├── renderer/    # React 渲染层：3D 场景（GalacticScene/Planet/Star）、UI 组件
└── shared/      # 主/渲染进程共用：类型定义、视觉映射规则
```

## 规格文档

产品与技术规格见 `docs/GalacticFS.md`（v2.0，2026-08-18）。

## 已知限制

- 扫描深度固定为 3（根 → 子星系 → 子星系文件；更深层不展开），全量递归可通过 `ScanOptions.maxDepth: 0` 开启
- 目录星体大小按内容递归统计（大目录扫描稍慢，忽略列表可加速）
- 大目录（>500 条目）名称标签自动隐藏以保证帧率
- 自动更新源目前为占位地址，正式发布时替换 `electron-builder.yml` 的 `publish.url`
