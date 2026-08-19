# GalacticFS 完整产品技术文档

**项目名称**：GalacticFS  
**版本**：v1.0.0  
**文档版本**：2.0  
**更新日期**：2026-08-18  
**状态**：探索性技术演示 / 桌面应用

## 一、项目概述

### 1.1 项目简介

**GalacticFS** 是一款基于 Electron + Three.js + React 构建的 3D 空间文件可视化浏览器。它将本地文件系统映射为沉浸式宇宙场景——目录是恒星，文件是行星，用户通过旋转、缩放、点击在"星空中漫游"的方式浏览文件。

**核心价值**：重塑文件浏览体验——从枯燥的列表点击，升级为充满探索感的视觉漫游。这不是一个替代品，而是一种全新的"浏览"可能性。

### 1.2 产品定位

| 维度         | 说明                                               |
| ------------ | -------------------------------------------------- |
| **产品类型** | 桌面应用 / 技术演示 / 概念产品                     |
| **目标用户** | 开发者、设计师、技术爱好者、数码极客、毕业设计展示 |
| **使用场景** | 个人文件浏览、硬盘内容探索、创意灵感收集、技术演示 |
| **核心理念** | 只读浏览，零操作风险                               |
| **商业化**   | 开源免费，不追求商业盈利                           |

### 1.3 设计原则

1. **安全第一**：所有文件操作均为只读，无删除、移动、重命名等高风险功能
2. **视觉驱动**：以 3D 宇宙场景为核心，营造沉浸式探索体验
3. **系统集成**：无缝融入操作系统（托盘菜单、右键菜单）
4. **性能优先**：海量文件场景下保持流畅交互
5. **智能缓存**：缩略图缓存机制让二次浏览体验飞跃

### 1.4 项目口号

**英文**：_"Explore your files. Not as a list, but as a universe."_

**中文**：_"探索你的文件——不是列表，而是一个宇宙。"_

## 二、功能需求

### 2.1 核心功能（P0 - 必须实现）

| 功能模块         | 功能描述                                                                                | 优先级 |
| ---------------- | --------------------------------------------------------------------------------------- | ------ |
| **文件系统扫描** | 扫描用户指定目录（默认：用户主目录），构建文件树数据结构                                | P0     |
| **3D 场景渲染**  | 目录映射为带星环的恒星，文件映射为行星；大小→文件大小，颜色→文件类型，发光→最近修改时间 | P0     |
| **视角控制**     | 鼠标拖拽旋转、滚轮缩放、右键平移（OrbitControls）                                       | P0     |
| **点选与高亮**   | 点击选中单个星球（射线检测），外圈发光环 + 轻微放大反馈                                 | P0     |
| **文件信息预览** | 侧边栏显示：文件名、大小、路径、修改时间、文件类型图标                                  | P0     |
| **双击打开**     | 双击文件星球→系统默认应用打开；双击文件夹→"进入"该目录（切换场景）                      | P0     |
| **路径导航**     | 界面顶部显示当前路径面包屑，支持点击回退                                                | P0     |
| **加载进度**     | 首次扫描时显示进度条（文件名、已扫描数量）                                              | P0     |
| **框选多选**     | 在 3D 场景拖拽绘制矩形区域，批量选中文件，右侧面板展示选中列表                          | P0     |

### 2.2 扩展功能（P1 - 重要）

| 功能模块                 | 功能描述                                                                 | 优先级 |
| ------------------------ | ------------------------------------------------------------------------ | ------ |
| **系统托盘菜单**         | 应用常驻后台，托盘图标支持：显示/隐藏主窗口、检查更新、退出              | P1     |
| **Windows 右键菜单集成** | 在文件/文件夹上右键 → "在 GalacticFS 中浏览"，安装时注册，卸载时自动移除 | P1     |
| **自动更新**             | 启动时检查更新，支持全量更新 + 增量更新（节省流量）                      | P1     |
| **自定义安装页面**       | 安装包带品牌化安装向导（自定义背景、Logo、许可协议等）                   | P1     |
| **缩略图缓存**           | 基于 SQLite 缓存图片/视频缩略图，二次浏览秒级加载                        | P1     |
| **搜索高亮**             | 输入文件名关键词，场景中匹配的星球发光闪烁                               | P1     |
| **视觉美化**             | 粒子背景星云、星球自转动画、光晕/辉光特效                                | P1     |
| **用户配置记忆**         | 记住默认启动路径、上次打开路径、窗口大小                                 | P1     |

### 2.3 高阶功能（P2 - 锦上添花）

| 功能模块               | 功能描述                                           | 优先级 |
| ---------------------- | -------------------------------------------------- | ------ |
| **引力选择**           | 双击文件夹发出引力波，自动吸附周围文件（创意交互） | P2     |
| **右键菜单（应用内）** | 在星球上右键弹出：复制路径、在文件管理器中定位     | P2     |
| **导出场景截图**       | 一键保存当前 3D 场景为 PNG 图片                    | P2     |
| **双模切换**           | 3D 场景 / 2D 列表 一键切换                         | P2     |
| **标签系统**           | 用户自定义标签，基于标签筛选文件                   | P2     |

### 2.4 明确排除的功能

| 功能                                     | 排除原因                       |
| ---------------------------------------- | ------------------------------ |
| 文件删除（含回收站）                     | 零风险原则，避免误删系统文件   |
| 文件移动/复制/重命名                     | 同上，只读浏览器定位           |
| 文件关联（双击系统文件默认用本应用打开） | 避免改变系统默认行为，保持轻量 |
| Everything 式全局搜索引擎                | 降低开发复杂度，非核心定位     |

## 三、技术方案

### 3.1 技术栈总览

| 层级              | 技术选型           | 版本               | 说明                                       |
| ----------------- | ------------------ | ------------------ | ------------------------------------------ |
| **桌面框架**      | Electron           | ^43.0.0 或 ^44.0.0 | 主进程 + 渲染进程架构，内置最新 Chromium   |
| **3D 渲染引擎**   | Three.js           | r185               | 最新稳定版，支持 WebGPU                    |
| **UI 框架**       | React              | ^19.2.x            | 最新版本，引入 Actions、`use` API          |
| **3D React 绑定** | @react-three/fiber | ^9.0.0             | 声明式 Three.js                            |
| **3D 工具库**     | @react-three/drei  | ^10.0.0            | 包含 Select 组件（框选）、OrbitControls 等 |
| **构建工具**      | Vite               | ^6.0.0             | 极速启动和热更新                           |
| **文件扫描**      | @immich/walkrs     | ^0.2.0             | Rust 实现，高性能扫描                      |
| **结构化存储**    | better-sqlite3     | ^11.0.0            | 缩略图缓存（同步 API，简单高效）           |
| **配置存储**      | electron-store     | ^10.0.0            | 用户配置、窗口状态                         |
| **系统集成**      | electron-builder   | ^25.0.0            | 打包、安装程序、更新                       |
| **自动更新**      | electron-updater   | ^6.3.0             | 全量 + 增量更新（通过 .blockmap）          |
| **NSIS 脚本**     | 自定义             | -                  | 安装程序定制 + 右键菜单注册/卸载           |

### 3.2 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Electron App                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    主进程 (Main Process)                         │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │ │
│  │  │ 文件扫描引擎  │ │ 托盘管理     │ │ 自动更新控制器          │  │ │
│  │  │ (walkrs)     │ │ (Tray)      │ │ (electron-updater)      │  │ │
│  │  └──────┬───────┘ └──────┬───────┘ └────────────┬────────────┘  │ │
│  │         │                │                        │               │ │
│  │         ▼                ▼                        ▼               │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                    IPC 通信层 (ipcMain)                     │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │                              │                                    │ │
│  │  ┌───────────────────────────┼──────────────────────────────┐    │ │
│  │  │                           ▼                              │    │ │
│  │  │     ┌─────────────┐  ┌─────────────────────┐            │    │ │
│  │  │     │ electron-   │  │   better-sqlite3    │            │    │ │
│  │  │     │ store       │  │   (缩略图缓存)       │            │    │ │
│  │  │     │ (配置存储)   │  └─────────────────────┘            │    │ │
│  │  │     └─────────────┘                                      │    │ │
│  │  └───────────────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                   │                                   │
│  ┌────────────────────────────────┼──────────────────────────────────┐ │
│  │                                ▼                                  │ │
│  │                 渲染进程 (Renderer Process)                       │ │
│  │  ┌─────────────────────────────┐  ┌────────────────────────────┐ │ │
│  │  │  @react-three/fiber 场景    │  │   React UI 层              │ │ │
│  │  │  ┌───────────────────────┐ │  │   ┌──────────────────────┐ │ │ │
│  │  │  │ Select (框选多选)     │ │  │   │ 侧边栏 (文件信息)     │ │ │ │
│  │  │  │ OrbitControls (视角)  │ │  │   │ 面包屑导航            │ │ │ │
│  │  │  │ 星球组件 (纹理贴图)   │ │  │   │ 搜索输入框            │ │ │ │
│  │  │  └───────────────────────┘ │  │   │ 选中信息面板          │ │ │ │
│  │  └─────────────────────────────┘  └────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 数据存储方案（双层架构）

| 存储层     | 技术                    | 存储内容                                               | 写入频率                |
| ---------- | ----------------------- | ------------------------------------------------------ | ----------------------- |
| **配置层** | electron-store (JSON)   | 默认启动路径、上次打开路径、窗口大小、主题设置         | 低频（用户主动操作）    |
| **缓存层** | better-sqlite3 (SQLite) | 缩略图缓存（file_path, file_modified, thumbnail_data） | 中频（浏览图片/视频时） |

**为什么保留 electron-store 并引入 better-sqlite3？**

- `electron-store`：轻量级 JSON 存储，API 简单（`get/set`），适合无结构化配置数据
- `better-sqlite3`：关系型数据库，支持百万级数据高效查询，适合结构化缓存数据

两者互补，各司其职，不是替代关系。

## 四、关键功能实现方案

### 4.1 系统托盘菜单 (Tray)

**实现位置**：主进程 (`src/main/tray.js`)

**功能清单**：

- 左键点击：显示/隐藏主窗口
- 右键点击：弹出上下文菜单
  - "打开主窗口"
  - "检查更新"
  - "关于"（显示版本信息）
  - "退出"

**核心代码**：

```javascript
// src/main/tray.js
const { app, Tray, Menu, nativeImage } = require('electron')
const path = require('path')

let tray = null

function createTray(mainWindow) {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray-icon.png'))
  tray = new Tray(icon)
  tray.setToolTip('GalacticFS - 3D 文件浏览器')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.isVisible() ? mainWindow.show() : mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: '检查更新',
      click: () => {
        /* 触发 autoUpdater 检查 */
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    }
  })

  return tray
}

module.exports = { createTray }
```

### 4.2 Windows 右键菜单集成

**实现方案**：通过 NSIS 脚本在安装/卸载时操作注册表。

**注册表路径**：

- 文件右键菜单：`HKEY_CLASSES_ROOT\*\shell\GalacticFS`
- 文件夹右键菜单：`HKEY_CLASSES_ROOT\Directory\shell\GalacticFS`

**NSIS 脚本** (`installer/installer.nsh`)：

```nsis
; ============================================
; 安装时执行的注册脚本
; ============================================
!macro customInstall
  WriteRegStr HKCR "*\shell\GalacticFS" "" "在 GalacticFS 中浏览"
  WriteRegStr HKCR "*\shell\GalacticFS" "Icon" "$INSTDIR\GalacticFS.exe,0"
  WriteRegStr HKCR "*\shell\GalacticFS\command" "" '"$INSTDIR\GalacticFS.exe" "--open-path" "%1"'

  WriteRegStr HKCR "Directory\shell\GalacticFS" "" "在 GalacticFS 中浏览"
  WriteRegStr HKCR "Directory\shell\GalacticFS" "Icon" "$INSTDIR\GalacticFS.exe,0"
  WriteRegStr HKCR "Directory\shell\GalacticFS\command" "" '"$INSTDIR\GalacticFS.exe" "--open-path" "%1"'
!macroend

; ============================================
; 卸载时执行的清理脚本（自动取消注册）
; ============================================
!macro customUnInstall
  DeleteRegKey HKCR "*\shell\GalacticFS"
  DeleteRegKey HKCR "Directory\shell\GalacticFS"
!macroend
```

**主进程接收参数**：

```javascript
// src/main/main.js
app.whenReady().then(() => {
  const args = process.argv
  const index = args.indexOf('--open-path')
  if (index !== -1 && args[index + 1]) {
    const openPath = args[index + 1]
    // 通过 IPC 发送到渲染进程
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('set-root-path', openPath)
    })
  }
})
```

### 4.3 自定义安装页面（品牌化安装向导）

**实现方式**：编写自定义 NSIS 脚本，替换默认安装界面。

**目录结构**：

```
installer/
├── custom-installer.nsi       # 主安装脚本
├── installer.nsh              # 右键菜单注册/卸载
├── branding/
│   ├── header.bmp             # 安装向导顶部横幅 (150x57)
│   ├── left.bmp               # 左侧边栏背景图 (164x314)
│   ├── logo.ico               # 安装包图标
│   └── finish.bmp             # 完成页背景图
└── include/
    ├── custom-pages.nsh
    └── custom-strings.nsh
```

**关键配置** (`package.json`)：

```json
{
  "build": {
    "win": {
      "target": "nsis",
      "icon": "installer/branding/logo.ico"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "include": "installer/custom-installer.nsi"
    }
  }
}
```

### 4.4 自动更新（全量 + 增量）

**依赖**：`electron-updater`

**更新策略**：

- 首次发布时生成 `.blockmap` 文件
- 后续版本：服务器同时保留全量包和增量包（自动生成）
- 客户端自动判断并下载最小差异包

**配置** (`package.json`)：

```json
{
  "build": {
    "publish": [
      {
        "provider": "generic",
        "url": "https://your-update-server.com/updates/"
      }
    ],
    "generateBlockmap": true
  }
}
```

**主进程更新代码**：

```javascript
// src/main/updater.js
const { autoUpdater } = require('electron-updater')
const { dialog } = require('electron')

function setupAutoUpdater() {
  autoUpdater.setFeedURL('https://your-update-server.com/updates/')

  // 启动后延迟检查
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 3000)

  autoUpdater.on('update-available', (info) => {
    // 可选：在 UI 中显示提示
    console.log('发现新版本:', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    const result = dialog.showMessageBoxSync({
      type: 'info',
      buttons: ['立即重启', '稍后'],
      title: '更新就绪',
      message: `新版本 ${info.version} 已下载完成，是否重启安装？`
    })
    if (result === 0) {
      autoUpdater.quitAndInstall()
    }
  })
}
```

### 4.5 框选多选与信息展示（@react-three/drei Select）

**核心实现**：

```jsx
import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Select, OrbitControls } from '@react-three/drei'

function GalacticScene({ files }) {
  const [selectedFiles, setSelectedFiles] = useState([])

  const handleSelectionChange = (selectedObjects) => {
    const files = selectedObjects.map((obj) => obj.userData.file)
    setSelectedFiles(files)
  }

  return (
    <>
      <Canvas camera={{ position: [0, 10, 15] }}>
        <OrbitControls />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <Select box multiple onChange={handleSelectionChange}>
          {files.map((file, index) => (
            <Planet
              key={file.path}
              file={file}
              position={[Math.random() * 10 - 5, 0, Math.random() * 10 - 5]}
              userData={{ file }}
            />
          ))}
        </Select>
      </Canvas>

      {/* 选中信息面板 */}
      <SelectionPanel selectedFiles={selectedFiles} />
    </>
  )
}

function SelectionPanel({ selectedFiles }) {
  if (selectedFiles.length === 0) {
    return <div style={panelStyle}>未选中任何文件</div>
  }

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0)

  return (
    <div style={panelStyle}>
      <h3>已选中 {selectedFiles.length} 个项目</h3>
      <p>总大小: {(totalSize / 1024 / 1024).toFixed(2)} MB</p>
      <ul>
        {selectedFiles.slice(0, 10).map((file) => (
          <li key={file.path}>{file.name}</li>
        ))}
        {selectedFiles.length > 10 && <li>...还有 {selectedFiles.length - 10} 个</li>}
      </ul>
    </div>
  )
}

const panelStyle = {
  position: 'absolute',
  bottom: '20px',
  right: '20px',
  width: '320px',
  maxHeight: '300px',
  overflowY: 'auto',
  background: 'rgba(0,0,0,0.85)',
  color: 'white',
  padding: '16px',
  borderRadius: '12px',
  backdropFilter: 'blur(10px)',
  fontFamily: 'sans-serif',
  zIndex: 10
}
```

### 4.6 缩略图缓存系统

**架构**：`better-sqlite3`（主进程）+ IPC + React 组件渲染

#### 4.6.1 数据库表结构

```sql
CREATE TABLE IF NOT EXISTS thumbnails (
    file_path TEXT PRIMARY KEY,
    file_modified INTEGER,
    thumbnail_data BLOB,
    width INTEGER,
    height INTEGER
);
```

#### 4.6.2 缩略图生成（主进程）

**支持的格式**：图片（PNG, JPG, GIF, BMP, WebP, ICO, TIFF）和视频（MP4, MOV, AVI, MKV, WMV, FLV, WebM, M4V）。  
**不支持的格式**：降级为 `app.getFileIcon()` 返回文件类型图标。

```javascript
// src/main/thumbnail-generator.js
const { nativeImage, app } = require('electron')
const fs = require('fs')
const path = require('path')

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.ico',
  '.tiff',
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v'
])

async function generateThumbnail(filePath, size = 256) {
  if (!fs.existsSync(filePath)) return null

  const stats = fs.statSync(filePath)
  const ext = path.extname(filePath).toLowerCase()

  if (SUPPORTED_EXTENSIONS.has(ext)) {
    try {
      const img = await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size })
      return {
        data: img.toPNG(),
        width: size,
        height: size,
        modified: stats.mtimeMs,
        type: 'thumbnail'
      }
    } catch (e) {
      // 降级到图标
    }
  }

  // 降级：返回文件类型图标
  const icon = await app.getFileIcon(filePath, { size: 'large' })
  return {
    data: icon.toPNG(),
    width: icon.getSize().width,
    height: icon.getSize().height,
    modified: stats.mtimeMs,
    type: 'icon'
  }
}
```

#### 4.6.3 数据库操作封装

```javascript
// src/main/thumbnail-db.js
const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

class ThumbnailDB {
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'thumbnails.db')
    this.db = new Database(dbPath)
    this.init()
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS thumbnails (
        file_path TEXT PRIMARY KEY,
        file_modified INTEGER,
        thumbnail_data BLOB,
        width INTEGER,
        height INTEGER
      )
    `)
  }

  get(filePath) {
    const stmt = this.db.prepare('SELECT * FROM thumbnails WHERE file_path = ?')
    return stmt.get(filePath)
  }

  set(filePath, fileModified, data, width, height) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO thumbnails (file_path, file_modified, thumbnail_data, width, height)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(filePath, fileModified, data, width, height)
  }

  close() {
    this.db.close()
  }
}

module.exports = new ThumbnailDB()
```

#### 4.6.4 IPC 接口

```javascript
// src/main/main.js
ipcMain.handle('get-thumbnail', async (event, filePath) => {
  const cached = thumbnailDB.get(filePath)
  if (cached) {
    const stats = fs.statSync(filePath)
    if (stats.mtimeMs === cached.file_modified) {
      return {
        data: cached.thumbnail_data,
        width: cached.width,
        height: cached.height,
        fromCache: true
      }
    }
  }

  const result = await generateThumbnail(filePath)
  if (result) {
    thumbnailDB.set(filePath, result.modified, result.data, result.width, result.height)
    return { data: result.data, width: result.width, height: result.height, fromCache: false }
  }
  return null
})
```

#### 4.6.5 React 组件使用

```jsx
// src/renderer/components/Planet.jsx
function Planet({ filePath, ...props }) {
  const [thumbnailUrl, setThumbnailUrl] = useState(null)

  useEffect(() => {
    window.electronAPI.getThumbnail(filePath).then((result) => {
      if (result) {
        const blob = new Blob([result.data], { type: 'image/png' })
        setThumbnailUrl(URL.createObjectURL(blob))
      }
    })
  }, [filePath])

  const texture = useLoader(TextureLoader, thumbnailUrl || '')

  return (
    <mesh {...props}>
      <sphereGeometry args={[0.5, 32, 32]} />
      {thumbnailUrl ? (
        <meshStandardMaterial map={texture} />
      ) : (
        <meshStandardMaterial color="gray" />
      )}
    </mesh>
  )
}
```

## 五、用户配置管理（electron-store）

```javascript
// src/main/config.js
const Store = require('electron-store')

const schema = {
  defaultRootPath: {
    type: 'string',
    default: process.env.USERPROFILE || process.env.HOME || '/'
  },
  lastOpenedPath: {
    type: 'string',
    default: ''
  },
  recentPaths: {
    type: 'array',
    default: [],
    maxItems: 10
  },
  windowBounds: {
    type: 'object',
    default: { width: 1200, height: 800 }
  }
}

const store = new Store({ schema })

module.exports = {
  getDefaultRootPath: () => store.get('defaultRootPath'),
  setDefaultRootPath: (p) => store.set('defaultRootPath', p),
  getLastOpenedPath: () => store.get('lastOpenedPath'),
  setLastOpenedPath: (p) => {
    store.set('lastOpenedPath', p)
    // 同时更新最近列表
    const recent = store.get('recentPaths', []).filter((r) => r !== p)
    recent.unshift(p)
    if (recent.length > 10) recent.pop()
    store.set('recentPaths', recent)
  },
  getRecentPaths: () => store.get('recentPaths'),
  getWindowBounds: () => store.get('windowBounds'),
  setWindowBounds: (b) => store.set('windowBounds', b)
}
```

## 六、交互设计

### 6.1 3D 场景视觉映射规则

| 文件属性         | 3D 视觉映射                                                  |
| ---------------- | ------------------------------------------------------------ |
| **文件/文件夹**  | 文件夹 = 带星环的行星；文件 = 普通行星                       |
| **文件大小**     | 星球半径（0.2 ~ 3.0 单位，对数缩放）                         |
| **文件类型**     | 颜色：图片=绿，视频=蓝，文档=橙，代码=紫，压缩包=红，其他=灰 |
| **最近修改时间** | 发光强度：1周内=高亮，1月内=正常，更久=暗淡                  |
| **目录层级**     | 轨道半径（父目录在内圈，子目录在外圈扩散）                   |
| **有缩略图**     | 星球表面贴图 = 文件缩略图（图片/视频）                       |
| **无缩略图**     | 星球表面 = 文件类型颜色                                      |

### 6.2 核心交互流程

```
启动应用
    ↓
读取配置：lastOpenedPath || defaultRootPath
    ↓
扫描目标目录（显示进度条）
    ↓
渲染 3D 场景
    ↓
用户交互：
    ├─ 鼠标拖拽 → 旋转视角
    ├─ 滚轮滚动 → 缩放
    ├─ 点击星球 → 侧边栏显示文件信息
    ├─ 拖拽框选 → 批量选中，展示信息面板
    ├─ 双击文件 → 系统应用打开
    ├─ 双击文件夹 → 进入子目录（场景切换动画）
    └─ 点击面包屑 → 返回上级目录
```

### 6.3 交互反馈规范

| 操作       | 视觉反馈                            |
| ---------- | ----------------------------------- |
| 鼠标悬停   | 星球边缘发光 + 光标变手型           |
| 点击选中   | 外圈出现旋转发光环 + 放大 1.15 倍   |
| 框选进行中 | 地面绘制半透明矩形框                |
| 框选完成   | 选中星球集体高亮 + 信息面板更新     |
| 进入文件夹 | 相机飞向目标 + 场景渐变过渡（0.5s） |
| 搜索匹配   | 匹配星球脉冲闪烁                    |
| 加载中     | 全局进度条 + 已扫描文件计数         |
| 错误       | 红色 Toast 提示                     |

## 七、非功能需求

### 7.1 性能指标

| 指标               | 目标值                  | 说明                         |
| ------------------ | ----------------------- | ---------------------------- |
| **首次启动扫描**   | < 3 秒（10 万文件以内） | 使用 Rust 原生扫描库         |
| **场景渲染帧率**   | ≥ 30 FPS                | InstancedMesh + LOD 动态降级 |
| **缩略图缓存读取** | < 10 ms                 | SQLite 主键查询              |
| **缩略图生成**     | < 500 ms/张             | 异步生成，不阻塞 UI          |
| **内存占用**       | ≤ 350 MB（空载）        | 含 3D 场景 + 缩略图缓存      |
| **安装包体积**     | ≤ 150 MB                | 含 Electron 运行时           |

### 7.2 兼容性

| 平台        | 版本                              | 优先级    |
| ----------- | --------------------------------- | --------- |
| **Windows** | 10 (1809+) / 11                   | ✅ 主推   |
| **macOS**   | 11 (Big Sur) + (含 Apple Silicon) | ⚠️ 支持   |
| **Linux**   | Ubuntu 20.04+                     | ⚠️ 实验性 |

## 八、里程碑规划

| 阶段              | 时间      | 核心产出                                        | 交付物        |
| ----------------- | --------- | ----------------------------------------------- | ------------- |
| **P0 - 概念验证** | 第 1-2 周 | 3D 场景 + 文件映射 + 基础交互 + 配置存储        | 可执行 Demo   |
| **P1 - 系统集成** | 第 3-4 周 | 托盘菜单 + 右键菜单注册 + 自定义安装 + 自动更新 | 完整安装包    |
| **P2 - 核心交互** | 第 5-6 周 | 框选多选 + 缩略图缓存 + 搜索高亮                | 功能完整版本  |
| **P3 - 打磨发布** | 第 7-8 周 | 性能优化 + Bug 修复 + 打包发布                  | v1.0.0 正式版 |

## 九、风险与应对

| 风险                 | 影响             | 应对策略                                 |
| -------------------- | ---------------- | ---------------------------------------- |
| **3D 场景卡顿**      | 用户体验差       | 预实施 InstancedMesh + LOD，设帧率监控   |
| **文件扫描阻塞 UI**  | 启动等待感强     | Worker 线程 + 进度条反馈                 |
| **缩略图数据库膨胀** | 占用磁盘空间     | 限制缓存数量（如 5000 张），提供清理入口 |
| **右键菜单注册失败** | 系统集成不可用   | 安装脚本加日志，提供手动修复 .reg 文件   |
| **自动更新下载失败** | 用户无法获取新版 | 提供官网手动下载入口 + 重试机制          |
| **跨平台兼容性**     | 部分用户无法使用 | Windows 为主，macOS/Linux 明确标注实验性 |

## 十、开发指南

### 10.1 快速启动

```bash
# 1. 克隆项目
git clone https://github.com/yourname/GalacticFS.git
cd GalacticFS

# 2. 安装依赖
npm install

# 3. 开发模式运行
npm run dev

# 4. 打包安装包（Windows）
npm run build:win

# 5. 输出目录
# dist/GalacticFS Setup 1.0.0.exe
```

### 10.2 目录结构

```
GalacticFS/
├── src/
│   ├── main/                      # 主进程
│   │   ├── main.js                # 入口
│   │   ├── tray.js                # 托盘管理
│   │   ├── config.js              # electron-store 配置
│   │   ├── thumbnail-db.js        # better-sqlite3 缩略图缓存
│   │   ├── thumbnail-generator.js # 缩略图生成（原生 API）
│   │   ├── file-scanner.js        # 文件扫描（walkrs）
│   │   └── updater.js             # 自动更新
│   ├── renderer/                  # 渲染进程
│   │   ├── index.html
│   │   ├── main.jsx               # React 入口
│   │   ├── App.jsx                # 根组件
│   │   ├── components/
│   │   │   ├── GalacticScene.jsx  # 3D 场景（@react-three/fiber）
│   │   │   ├── Planet.jsx         # 星球组件（含缩略图贴图）
│   │   │   ├── SelectionPanel.jsx # 框选信息面板
│   │   │   ├── Sidebar.jsx        # 侧边栏
│   │   │   └── Breadcrumb.jsx     # 路径导航
│   │   └── styles/
│   │       └── index.css
│   └── preload/
│       └── preload.js             # 预加载脚本（暴露 API）
├── installer/                     # 安装脚本
│   ├── custom-installer.nsi       # 主 NSIS 脚本
│   ├── installer.nsh              # 右键菜单注册/卸载
│   └── branding/                  # 品牌素材
│       ├── header.bmp
│       ├── left.bmp
│       └── logo.ico
├── assets/
│   └── tray-icon.png
├── build/
│   └── icon.ico
├── package.json
├── electron-builder.yml
├── vite.config.js
└── README.md
```

### 10.3 预加载脚本 API 暴露

```javascript
// src/preload/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 缩略图
  getThumbnail: (filePath) => ipcRenderer.invoke('get-thumbnail', filePath),
  // 目录扫描
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  // 配置
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  // 打开文件（系统默认应用）
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  // 路径事件（右键菜单传入）
  onSetRootPath: (callback) => ipcRenderer.on('set-root-path', (event, path) => callback(path))
})
```

## 十一、成功标准

### 11.1 技术成功标准

- [ ] 10 万文件扫描 < 3 秒
- [ ] 3D 场景帧率 ≥ 30 FPS（常规硬件）
- [ ] 安装包体积 < 150 MB
- [ ] 缩略图缓存命中率 > 80%（二次浏览）
- [ ] 右键菜单注册/卸载成功率 > 99%
- [ ] 应用崩溃率 < 1%

### 11.2 用户/社区成功标准

- [ ] GitHub Star 数 ≥ 500（发布后 6 个月）
- [ ] 至少 3 篇技术博客/视频介绍
- [ ] 在 V2EX/Reddit 获得正面反馈

## 十二、附录

### 附录 A：项目命名

| 名称           | 状态         |
| -------------- | ------------ |
| **GalacticFS** | ⭐ 首选      |
| Nova Explorer  | 备选         |
| 星界           | 中文展示专用 |

### 附录 B：品牌色系

| 用途     | 色值                   |
| -------- | ---------------------- |
| 深空背景 | #0B0C10                |
| 星云青   | #45A29E                |
| 高亮橙   | #FF6B35                |
| 恒星金   | #F5C842                |
| 文字白   | #FFFFFF                |
| 毛玻璃   | rgba(255,255,255,0.08) |

### 附录 C：许可证

**MIT License**（推荐）

> **文档结束**
>
> _GalacticFS —— 让文件管理，成为一场星际漫游。_ 🚀
