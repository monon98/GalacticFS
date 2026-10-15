/**
 * 共享类型：主进程与渲染进程共用的数据结构。
 * FileNode 由扫描器产出，经 IPC 传递到渲染进程驱动 3D 场景。
 */

export interface FileNode {
  name: string
  path: string
  size: number
  mtimeMs: number
  isDirectory: boolean
  children?: FileNode[]
}

export interface ScanOptions {
  /** 是否包含隐藏文件（点开头），默认 false */
  includeHidden?: boolean
  /**
   * 最大扫描深度：1 = 仅根目录直接子项，2 = 再展开一层。
   * 默认 3（根 → 子星系 → 子星系文件可见）；传 0 表示不限制深度。
   */
  maxDepth?: number
  /** 忽略的目录名列表（精确匹配、大小写不敏感，如 node_modules/.git） */
  ignoredFolders?: string[]
  /**
   * 进度回调（每处理一个文件触发一次，计数为全扫描累计值）。
   * @param scanned 已处理文件总数（单调递增）
   * @param currentPath 当前处理的文件路径
   * @param phase 'size' = 目录大小统计阶段；缺省为目录树扫描阶段
   */
  onProgress?: (scanned: number, currentPath: string, phase?: 'size') => void
  /** 中断信号：aborted 后扫描立即抛出 ScanAbortedError（协作式取消） */
  signal?: AbortSignal
  /** 首层直接子项就绪回调（分段渲染：先显示行星，完整树完成后替换） */
  onFirstLevel?: (root: FileNode) => void
}

/** 扫描被中断时抛出的错误（由 signal.aborted 触发） */
export class ScanAbortedError extends Error {
  constructor() {
    super('Scan aborted')
    this.name = 'ScanAbortedError'
  }
}

export interface ScanProgress {
  /** 已处理文件数（全扫描累计，含大小统计阶段，单调递增） */
  scanned: number
  currentPath: string
  /** 'size' = 目录大小统计阶段（树已就绪、仍在计算星体半径）；缺省为目录扫描阶段 */
  phase?: 'size'
}

export interface ThumbnailResult {
  /** PNG 图片二进制（主进程为 Buffer，经 IPC 序列化为 Uint8Array） */
  data: Uint8Array
  width: number
  height: number
  fromCache: boolean
}
