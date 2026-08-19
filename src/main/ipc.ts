/**
 * IPC 处理器注册：主进程与渲染进程的通信层（文档 §4.6.4 + §10.3）。
 * 通道约定：invoke/handle 双工（scan-directory、get-thumbnail、get/set-config、open-file），
 * 单向事件推送（scan-progress、scan-partial、set-root-path）。
 * 扫描性能：内存缓存（目录 mtime + TTL）避免重复扫描；
 * AbortController 顶替旧扫描（快速切换目录时中断未完成扫描）；
 * scan-partial 分段推送首层结果，渲染层先显示行星再等完整树。
 */

import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { statSync } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import type { FileScanner } from './file-scanner'
import type { ThumbnailDB } from './thumbnail-db'
import type { ConfigStore } from './config-store'
import type { FileNode } from '../shared/types'
import { ScanAbortedError } from '../shared/types'
import { canPreview, PREVIEW_MAX_BYTES } from '../shared/preview'
import { generateThumbnail } from './thumbnail-generator'
import { collectFolderStats } from './folder-stats'

/** 扫描缓存 TTL（毫秒）：目录 mtime 未变且未超时则直接复用结果 */
const SCAN_CACHE_TTL = 10_000

/** 扫描缓存：key = 目录路径，value = 目录 mtime + 扫描结果 + 时间戳 */
const scanCache = new Map<string, { mtimeMs: number; tree: FileNode; at: number }>()

/** 当前活跃扫描的中断控制器（全局单例：新扫描顶替旧扫描） */
let activeScan: AbortController | null = null

/** 允许渲染进程读写的配置键白名单（防止任意键注入） */
export const CONFIG_KEYS = [
  'defaultRootPath',
  'lastOpenedPath',
  'recentPaths',
  'windowBounds',
  'includeHidden',
  'ignoredFolders'
] as const
type ConfigKey = (typeof CONFIG_KEYS)[number]

function isConfigKey(key: unknown): key is ConfigKey {
  return typeof key === 'string' && (CONFIG_KEYS as readonly string[]).includes(key)
}

export function registerIpcHandlers(deps: {
  scanner: FileScanner
  thumbnailDB: ThumbnailDB
  configStore: ConfigStore
}): void {
  const { scanner, thumbnailDB, configStore } = deps

  // 扫描目录：进度通过 scan-progress 事件流式推送；首层就绪先发 scan-partial（分段渲染）。
  // 缓存命中（目录 mtime 未变 + TTL 内）直接返回，避免重复扫描；
  // 未命中时中止上一次扫描（快速切换目录），扫描选项从配置读取，深度固定 3。
  ipcMain.handle('scan-directory', async (event, dirPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      includeHidden: configStore.includeHidden,
      ignoredFolders: configStore.ignoredFolders,
      maxDepth: 3,
      onProgress: (scanned: number, currentPath: string) => {
        win?.webContents.send('scan-progress', { scanned, currentPath })
      },
      onFirstLevel: (root: FileNode) => {
        win?.webContents.send('scan-partial', root)
      }
    }

    // 缓存命中：目录 mtime 未变且未超 TTL → 直接复用
    const cached = scanCache.get(dirPath)
    if (
      cached &&
      Date.now() - cached.at < SCAN_CACHE_TTL &&
      statSync(dirPath, { throwIfNoEntry: false })?.mtimeMs === cached.mtimeMs
    ) {
      return cached.tree
    }

    // 顶替旧扫描：快速切换目录时中止未完成的扫描
    activeScan?.abort()
    const controller = new AbortController()
    activeScan = controller
    try {
      const tree = await scanner.scan(dirPath, { ...options, signal: controller.signal })
      scanCache.set(dirPath, {
        mtimeMs: statSync(dirPath, { throwIfNoEntry: false })?.mtimeMs ?? 0,
        tree,
        at: Date.now()
      })
      return tree
    } catch (err) {
      // 被新扫描顶替（abort）：静默返回 null，渲染层已按请求序号丢弃迟到结果
      if (err instanceof ScanAbortedError) return null
      throw err
    } finally {
      if (activeScan === controller) activeScan = null
    }
  })

  // 缩略图：先查缓存（mtime 一致才算命中），未命中生成后写入缓存（文档 §4.6.4）
  ipcMain.handle('get-thumbnail', async (_event, filePath: string) => {
    const cached = thumbnailDB.get(filePath)
    if (cached) {
      try {
        if (statSync(filePath).mtimeMs === cached.fileModified) {
          return { data: cached.data, width: cached.width, height: cached.height, fromCache: true }
        }
      } catch {
        // 文件已不存在：走生成流程，返回 null
      }
    }
    const result = await generateThumbnail(filePath)
    if (!result) return null
    thumbnailDB.set(filePath, statSync(filePath).mtimeMs, result.data, result.width, result.height)
    return { data: result.data, width: result.width, height: result.height, fromCache: false }
  })

  ipcMain.handle('get-config', (_event, key: string) => {
    if (!isConfigKey(key)) throw new Error(`Unknown config key: ${key}`)
    return configStore[key]
  })

  ipcMain.handle('set-config', (_event, key: string, value: unknown) => {
    if (!isConfigKey(key)) throw new Error(`Unknown config key: ${key}`)
    switch (key) {
      case 'defaultRootPath':
        configStore.setDefaultRootPath(String(value))
        break
      case 'lastOpenedPath':
        configStore.setLastOpenedPath(String(value))
        break
      case 'windowBounds':
        configStore.setWindowBounds(value as { width: number; height: number })
        break
      case 'includeHidden':
        configStore.setIncludeHidden(Boolean(value))
        break
      case 'ignoredFolders':
        // 过滤非法值：仅接受字符串数组
        if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
          configStore.setIgnoredFolders(value as string[])
        } else {
          throw new Error('ignoredFolders must be a string array')
        }
        break
      case 'recentPaths':
        // 只读配置，不允许渲染进程直接改写
        throw new Error('Config key is read-only: recentPaths')
    }
  })

  // 系统默认应用打开文件；返回空字符串表示成功，否则为错误信息
  ipcMain.handle('open-file', (_event, filePath: string) => shell.openPath(filePath))

  // 在系统文件管理器中定位并选中该路径（文档 §2.3 应用内右键菜单"定位"）
  ipcMain.handle('show-item', (_event, itemPath: string) => {
    shell.showItemInFolder(itemPath)
  })

  // 保存场景截图：弹窗选择路径后写入 PNG（文档 §2.3 导出场景截图）
  ipcMain.handle('save-screenshot', async (event, dataUrl: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: '导出场景截图',
      defaultPath: `galacticfs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (canceled || !filePath) return false
    // dataUrl 形如 "data:image/png;base64,...."
    const base64 = dataUrl.split(',')[1]
    if (!base64) return false
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    return true
  })

  // 文件夹格式统计（递归，选中文件夹时展示）；规则与扫描一致
  ipcMain.handle('folder-stats', (_event, dirPath: string) =>
    collectFolderStats(dirPath, {
      includeHidden: configStore.includeHidden,
      ignoredFolders: configStore.ignoredFolders
    })
  )

  // 文件详细信息（stat 全字段：创建/变更时间、大小、隐藏标志）；不存在时返回 null
  ipcMain.handle('file-info', (_event, filePath: string) => {
    try {
      const info = statSync(filePath)
      const name = filePath.split(/[\\/]/).pop() ?? ''
      return {
        name,
        path: filePath,
        size: info.size,
        mtimeMs: info.mtimeMs,
        ctimeMs: info.ctimeMs,
        birthtimeMs: info.birthtimeMs,
        isDirectory: info.isDirectory(),
        isHidden: name.startsWith('.')
      }
    } catch {
      return null
    }
  })

  // 文件内容预览：仅扩展名白名单内的文本文件（≤64KB），读取失败返回 null（只读浏览）。
  // 编码默认 UTF-8；解码遇无效字节（如 GBK 中文文本）时回退 GBK，避免预览乱码。
  ipcMain.handle('read-file-preview', async (_event, filePath: string) => {
    if (!canPreview(filePath)) return null
    try {
      const info = await stat(filePath)
      if (info.isDirectory() || info.size > PREVIEW_MAX_BYTES) return null
      const buffer = await readFile(filePath)
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      } catch {
        text = new TextDecoder('gbk').decode(buffer)
      }
      return { text }
    } catch {
      return null
    }
  })
}
