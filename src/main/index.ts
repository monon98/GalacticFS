/**
 * 主进程入口：窗口生命周期、IPC 注册、启动参数处理与配置持久化。
 * 数据层模块（扫描器/缩略图缓存/配置）在此实例化后注入 IPC 层；
 * 系统集成（托盘/右键菜单/更新器）也在启动时装配。
 */

import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { NodeFsScanner } from './file-scanner'
import { ThumbnailDB } from './thumbnail-db'
import { ConfigStore } from './config-store'
import { registerIpcHandlers } from './ipc'
import { createTray } from './tray'
import { checkForUpdates } from './updater'
import { installSystemIntegration } from './platform'

/** 缩略图缓存上限（文档 §九：防止数据库膨胀） */
const THUMBNAIL_CACHE_LIMIT = 5000

const configStore = new ConfigStore()
const thumbnailDB = new ThumbnailDB(join(app.getPath('userData'), 'thumbnails.db'))

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const bounds = configStore.windowBounds
  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  // 窗口尺寸变化时记忆，重启后恢复（文档 §2.2 用户配置记忆）
  const saveBounds = (): void => {
    if (!window.isDestroyed()) {
      configStore.setWindowBounds(window.getBounds())
    }
  }
  window.on('resize', saveBounds)
  window.on('move', saveBounds)

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 开发模式自动打开调试控制台（仅 dev，生产不暴露）
  if (is.dev) {
    window.webContents.on('did-finish-load', () => {
      window.webContents.openDevTools({ mode: 'detach' })
    })
  }

  return window
}

// 解析右键菜单/命令行传入的 "--open-path <path>"，窗口加载完成后转发给渲染进程（文档 §4.2）
function resolveOpenPathArg(): string | null {
  const index = process.argv.indexOf('--open-path')
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : null
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.galacticfs.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers({ scanner: new NodeFsScanner(), thumbnailDB, configStore })
  // 启动时清理超出上限的旧缓存
  thumbnailDB.prune(THUMBNAIL_CACHE_LIMIT)

  const window = createWindow()
  mainWindow = window

  // 打包后安装平台系统集成（Windows：注册表右键菜单"在 GalacticFS 中浏览"；其余平台跳过），
  // 失败仅告警不影响启动
  if (app.isPackaged) {
    installSystemIntegration(process.execPath).catch((err: unknown) => {
      console.error('[platform] 系统集成失败：', err)
    })
  }

  // 系统托盘（保持引用，防止被 GC 回收；平台不支持时返回 null 静默降级）
  const tray = createTray(() => mainWindow, checkForUpdates)
  if (tray) {
    void tray
  }

  const openPath = resolveOpenPathArg()
  if (openPath) {
    window.webContents.on('did-finish-load', () => {
      window.webContents.send('set-root-path', openPath)
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  thumbnailDB.close()
})
