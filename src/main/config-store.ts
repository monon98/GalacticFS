/**
 * 配置管理：基于 electron-store 的用户配置持久化（文档 §五）。
 * 存储内容：默认根路径、上次打开路径、最近路径列表（最多 10 条）、窗口尺寸。
 * 使用方式：new ConfigStore({ cwd }) 注入存储目录（生产环境由主进程传入 userData）。
 */

import { homedir } from 'node:os'
import Store from 'electron-store'

/** 窗口尺寸配置 */
export interface WindowBounds {
  width: number
  height: number
}

/** 全部用户配置项 */
export interface AppConfig {
  /** 默认扫描根目录（首次启动时用） */
  defaultRootPath: string
  /** 上次打开的目录，启动时优先于 defaultRootPath */
  lastOpenedPath: string
  /** 最近访问目录列表，最新的在最前，最多 10 条 */
  recentPaths: string[]
  /** 窗口尺寸 */
  windowBounds: WindowBounds
  /** 是否显示隐藏文件（点开头） */
  includeHidden: boolean
  /** 扫描时忽略的目录名列表（如 node_modules/.git） */
  ignoredFolders: string[]
}

const MAX_RECENT_PATHS = 10

export class ConfigStore {
  private store: Store<AppConfig>

  /**
   * @param options.cwd 配置文件存放目录（JSON 文件）；测试注入临时目录，生产省略（用 electron 的 userData）
   * @param options.defaults 覆盖默认配置值（如测试时固定 defaultRootPath）
   */
  constructor(options: { cwd?: string; defaults?: Partial<AppConfig> } = {}) {
    const defaults: AppConfig = {
      defaultRootPath: process.env.USERPROFILE || process.env.HOME || '/',
      lastOpenedPath: '',
      recentPaths: [],
      windowBounds: { width: 1200, height: 800 },
      includeHidden: false,
      ignoredFolders: [],
      ...options.defaults
    }
    this.store = new Store<AppConfig>({
      cwd: options.cwd,
      defaults
    })
  }

  get defaultRootPath(): string {
    return this.store.get('defaultRootPath')
  }

  setDefaultRootPath(path: string): void {
    this.store.set('defaultRootPath', path)
  }

  get lastOpenedPath(): string {
    return this.store.get('lastOpenedPath')
  }

  /**
   * 记录最近访问的目录：写入 lastOpenedPath，并插入 recentPaths 头部
   * （重复路径去重后置顶，列表裁剪到 10 条）。
   */
  setLastOpenedPath(path: string): void {
    this.store.set('lastOpenedPath', path)
    const recent = this.store.get('recentPaths', []).filter((p) => p !== path)
    recent.unshift(path)
    this.store.set('recentPaths', recent.slice(0, MAX_RECENT_PATHS))
  }

  get recentPaths(): string[] {
    return this.store.get('recentPaths', [])
  }

  get windowBounds(): WindowBounds {
    return this.store.get('windowBounds')
  }

  setWindowBounds(bounds: WindowBounds): void {
    this.store.set('windowBounds', bounds)
  }

  get includeHidden(): boolean {
    return this.store.get('includeHidden', false)
  }

  setIncludeHidden(value: boolean): void {
    this.store.set('includeHidden', value)
  }

  get ignoredFolders(): string[] {
    return this.store.get('ignoredFolders', [])
  }

  setIgnoredFolders(folders: string[]): void {
    this.store.set('ignoredFolders', folders)
  }
}

/** 返回系统用户主目录（无 electron 环境时的兜底根路径） */
export function defaultRootPath(): string {
  return homedir()
}
