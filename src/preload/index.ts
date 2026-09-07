/**
 * 预加载脚本：通过 contextBridge 向渲染进程暴露 window.electronAPI（文档 §10.3）。
 * 所有文件系统/IPC 访问都封装在此层，渲染进程不得直接接触 Node API。
 * 订阅类 API（onScanProgress/onSetRootPath）返回取消订阅函数。
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { FileNode, ScanOptions, ScanProgress, ThumbnailResult } from '../shared/types'
import type { FolderStats } from '../main/folder-stats'

const api = {
  /**
   * 获取文件缩略图（带 SQLite 缓存，命中且 mtime 一致时直接返回）。
   * @param filePath 文件绝对路径
   * @returns 缩略图数据；文件不存在时返回 null
   */
  getThumbnail: (filePath: string): Promise<ThumbnailResult | null> =>
    ipcRenderer.invoke('get-thumbnail', filePath),

  /**
   * 扫描目录并返回文件树。
   * @param dirPath 目录绝对路径
   * @param options 扫描选项（includeHidden 等）
   * @returns 根目录 FileNode（children 为直接子项）
   * @throws 路径不存在或不是目录时 reject
   */
  scanDirectory: (dirPath: string, options?: ScanOptions): Promise<FileNode> =>
    ipcRenderer.invoke('scan-directory', dirPath, options),

  /** 订阅扫描进度事件；返回取消订阅函数 */
  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, progress: ScanProgress): void => callback(progress)
    ipcRenderer.on('scan-progress', listener)
    return () => ipcRenderer.removeListener('scan-progress', listener)
  },

  /** 订阅首层扫描结果（分段渲染，先显示行星）；返回取消订阅函数 */
  onScanPartial: (callback: (root: FileNode) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, root: FileNode): void => callback(root)
    ipcRenderer.on('scan-partial', listener)
    return () => ipcRenderer.removeListener('scan-partial', listener)
  },

  /**
   * 读取配置项。
   * @param key 配置键（defaultRootPath/lastOpenedPath/recentPaths/windowBounds）
   */
  getConfig: <T>(key: string): Promise<T> => ipcRenderer.invoke('get-config', key),

  /** 写入配置项（白名单键，见主进程 ipc.ts） */
  setConfig: <T>(key: string, value: T): Promise<void> =>
    ipcRenderer.invoke('set-config', key, value),

  /**
   * 用系统默认应用打开文件。
   * @param filePath 文件绝对路径
   * @returns 空字符串表示成功，否则为错误信息
   */
  openFile: (filePath: string): Promise<string> => ipcRenderer.invoke('open-file', filePath),

  /**
   * 在系统文件管理器中定位并选中文件/文件夹（右键菜单"在文件管理器中定位"）。
   * @param itemPath 文件或文件夹绝对路径
   */
  showItemInFolder: (itemPath: string): Promise<void> => ipcRenderer.invoke('show-item', itemPath),

  /**
   * 保存场景截图：弹窗选择保存位置后写入 PNG。
   * @param dataUrl canvas.toDataURL() 输出（data:image/png;base64,...）
   * @returns 是否保存成功（取消返回 false）
   */
  saveScreenshot: (dataUrl: string): Promise<boolean> =>
    ipcRenderer.invoke('save-screenshot', dataUrl),

  /**
   * 统计文件夹内的文件格式分布（递归全量）。
   * @param dirPath 目录绝对路径
   * @returns 文件总数、总大小与按数量降序的扩展名分布
   */
  getFolderStats: (dirPath: string): Promise<FolderStats> =>
    ipcRenderer.invoke('folder-stats', dirPath),

  /**
   * 获取文件/目录的完整 stat 信息（创建/变更时间、隐藏标志等）。
   * @param filePath 绝对路径
   * @returns 详细信息；路径不存在时返回 null
   */
  getFileInfo: (
    filePath: string
  ): Promise<{
    name: string
    path: string
    size: number
    mtimeMs: number
    ctimeMs: number
    birthtimeMs: number
    isDirectory: boolean
    isHidden: boolean
  } | null> => ipcRenderer.invoke('file-info', filePath),

  /**
   * 读取文本文件内容预览（扩展名白名单 + ≤64KB，见 shared/preview.ts）。
   * @param filePath 文件绝对路径
   * @returns { text } 内容；非文本/过大/读取失败时返回 null
   */
  readFilePreview: (filePath: string): Promise<{ text: string } | null> =>
    ipcRenderer.invoke('read-file-preview', filePath),

  /**
   * 获取应用信息（版本号/平台），设置面板"关于"区域使用。
   */
  getAppInfo: (): Promise<{ version: string; platform: string }> => ipcRenderer.invoke('app-info'),

  /** 获取启动初始路径（右键菜单 --open-path 传入，一次性）；无则返回 null */
  getOpenPath: (): Promise<string | null> => ipcRenderer.invoke('get-open-path'),

  /** 订阅根路径设置事件（右键菜单 "--open-path" 参数传入）；返回取消订阅函数 */
  onSetRootPath: (callback: (path: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, path: string): void => callback(path)
    ipcRenderer.on('set-root-path', listener)
    return () => ipcRenderer.removeListener('set-root-path', listener)
  }
}

// contextIsolation 开启时通过 contextBridge 暴露，否则挂到 window（仅开发兜底）
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = api
}
