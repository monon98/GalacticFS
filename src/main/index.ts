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
let isQuitting = false // 区分"关闭隐藏"与"真正退出"

function createWindow(): BrowserWindow {
  const bounds = configStore.windowBounds
  const window = new BrowserWindow({
    width: bounds.width ?? 1280,
    height: bounds.height ?? 800,
    x: bounds.x,
    y: bounds.y,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 恢复最大化状态
  if (bounds.isMaximized) {
    window.maximize()
  }

  window.on('ready-to-show', () => {
    window.show()
  })

  // 关闭窗口时：Windows/Linux 隐藏到托盘，macOS 遵循原生行为（关闭即退出）
  window.on('close', (e) => {
    if (!isQuitting && process.platform !== 'darwin') {
      e.preventDefault()
      window.hide()
    }
  })

  // 窗口状态变化时记忆，重启后恢复（文档 §2.2 用户配置记忆）
  const saveBounds = (): void => {
    if (!window.isDestroyed()) {
      configStore.setWindowBounds({
        ...window.getBounds(),
        isMaximized: window.isMaximized()
      })
    }
  }
  window.on('resize', saveBounds)
  window.on('move', saveBounds)
  window.on('maximize', saveBounds)
  window.on('unmaximize', saveBounds)

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

app.whenReady().then(() => {
  // 单实例锁：防止多开；第二实例启动时通过 second-instance 事件转发 --open-path
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  electronApp.setAppUserModelId('com.galacticfs.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 监听第二实例启动：提取 --open-path 并转发给已有窗口
  app.on('second-instance', (_event, argv) => {
    const idx = argv.indexOf('--open-path')
    const path = idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null
    if (path && mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('set-root-path', path)
    }
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

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 非真正退出时（点 ✕ 隐藏到托盘）不退出进程；macOS 保持原生行为
  if (isQuitting && process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('quit', () => {
  thumbnailDB.close()
})
