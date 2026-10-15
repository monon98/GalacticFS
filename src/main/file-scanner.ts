/**
 * 文件扫描器：递归扫描目录并构建文件树（目录 = 恒星，文件 = 行星）。
 * 依据 docs/GalacticFS.md §2.1 P0 与 §4.6.2 的格式支持范围。
 * 深度默认 3：根目录 → 直接子目录（星体）→ 子目录内的直接文件（子星系行星）。
 * 目录 size 为内容递归统计（决定其星体半径）。
 * NodeFsScanner 基于 node:fs 实现，无原生依赖；
 * walkrs（Rust 加速）作为可选后端，待其发布 Windows 二进制后接入。
 */

import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Stats } from 'node:fs'
import type { FileNode, ScanOptions } from '../shared/types'
import { ScanAbortedError } from '../shared/types'

export type { FileNode, ScanOptions }
export { ScanAbortedError }

/** 扫描是否被外部中断（协作式取消，检查点抛错） */
function checkAborted(options: ScanOptions): void {
  if (options.signal?.aborted) {
    throw new ScanAbortedError()
  }
}

/** 目录大小统计：单轮并发处理的目录数（BFS 批次上限） */
const SIZE_DIR_BATCH = 8

/** 目录大小统计：单个目录内文件 stat 的分块并发数 */
const SIZE_STAT_CONCURRENCY = 16

/** 单次扫描共享的进度上下文（跨递归层级累计，驱动进度条单调递增） */
interface ScanContext {
  /** 已处理文件总数（全扫描累计） */
  processed: number
}

export interface FileScanner {
  /**
   * 扫描目录树。
   * @param rootPath 要扫描的目录路径
   * @param options 扫描选项（隐藏文件、忽略列表、最大深度、进度回调）
   * @returns 根目录对应的 FileNode（children 为直接子项）
   * @throws 路径不存在或不是目录时抛出错误（ENOENT / Not a directory）
   */
  scan(rootPath: string, options?: ScanOptions): Promise<FileNode>
}

export class NodeFsScanner implements FileScanner {
  /**
   * 扫描入口：校验根路径后递归构建树。
   * 单条目错误（权限不足、符号链接断裂等）会被吞掉，保证海量目录下扫描不中断。
   * 深度默认 3（一二级优先 + 子星系文件可见），通过 ScanOptions.maxDepth 控制。
   */
  async scan(rootPath: string, options: ScanOptions = {}): Promise<FileNode> {
    const rootStats = await stat(rootPath)
    if (!rootStats.isDirectory()) {
      throw new Error(`Not a directory: ${rootPath}`)
    }
    return this.scanDirectory(rootPath, rootStats, options, 1, { processed: 0 })
  }

  /** 是否命中忽略列表（精确匹配目录名，大小写不敏感） */
  private isIgnored(name: string, ignored: string[] | undefined): boolean {
    if (!ignored || ignored.length === 0) return false
    const lower = name.toLowerCase()
    return ignored.some((item) => item.toLowerCase() === lower)
  }

  /**
   * 递归统计目录内容总大小（决定星体半径，文档 §6.1 大小→半径）。
   * 不受深度限制（否则统计不完整）；隐藏/忽略规则与扫描一致。
   * 实现为逐层 BFS + 层内并发 stat：每轮最多 SIZE_DIR_BATCH 个目录并行、
   * 目录内文件分块并发——相比逐条串行 await 大幅缩短海量目录的统计时间，
   * 同时避免深层递归并发失控；每个批次检查中断信号保证 abort 及时生效。
   * @param dirPath 要统计的目录（调用方保证已通过隐藏/忽略过滤）
   * @returns 该目录树内所有文件的字节总和；单条目错误跳过（与扫描一致）
   */
  private async getDirectorySize(
    dirPath: string,
    options: ScanOptions,
    ctx: ScanContext
  ): Promise<number> {
    let total = 0
    const level: string[] = [dirPath]
    while (level.length > 0) {
      checkAborted(options)
      const batch = level.splice(0, SIZE_DIR_BATCH)
      const results = await Promise.all(batch.map((d) => this.collectDirSize(d, options, ctx)))
      for (const result of results) {
        total += result.size
        level.push(...result.subdirs)
      }
    }
    return total
  }

  /**
   * 收集单个目录：readdir 后将文件分块并发 stat（累计字节数并上报 size 阶段进度），
   * 过滤后的子目录路径交由上层 getDirectorySize 逐层处理。
   * @returns 本层文件字节总和与待统计的子目录路径列表
   */
  private async collectDirSize(
    dirPath: string,
    options: ScanOptions,
    ctx: ScanContext
  ): Promise<{ size: number; subdirs: string[] }> {
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => [])
    const subdirs: string[] = []
    const files: string[] = []
    for (const entry of entries) {
      checkAborted(options)
      if (!options.includeHidden && entry.name.startsWith('.')) continue
      if (entry.isDirectory() && this.isIgnored(entry.name, options.ignoredFolders)) continue
      if (entry.isDirectory()) subdirs.push(join(dirPath, entry.name))
      else if (entry.isFile()) files.push(join(dirPath, entry.name))
    }

    let size = 0
    for (let i = 0; i < files.length; i += SIZE_STAT_CONCURRENCY) {
      checkAborted(options)
      const chunk = files.slice(i, i + SIZE_STAT_CONCURRENCY)
      const sizes = await Promise.all(
        chunk.map(async (file) => {
          try {
            const fileStats = await stat(file)
            ctx.processed++
            options.onProgress?.(ctx.processed, file, 'size')
            return fileStats.size
          } catch {
            // 单文件 stat 失败（权限/已删除）跳过，与扫描的容错策略一致
            return 0
          }
        })
      )
      for (const fileStats of sizes) size += fileStats
    }
    return { size, subdirs }
  }

  /**
   * 自底向上累计目录内容总大小：children 已覆盖该目录的全部内容
   * （直接文件的字节 + 各子树的完整大小），因此无需再对整棵子树做重复遍历。
   * 深度受限未展开的叶子壳不在 children 中，由调用方用 getDirectorySize 兜底。
   */
  private sumChildren(node: FileNode): number {
    let total = 0
    for (const child of node.children ?? []) total += child.size
    return total
  }

  /**
   * 递归扫描单个目录。
   * @param depth 当前深度（根为 1）；depth >= maxDepth 时不再展开子目录（children 为空）
   * @param ctx 单次扫描共享的进度上下文（跨层级累计处理计数）
   * 分段渲染：depth === 1 时先快速收集直接子项（文件 stat、目录壳 size=0）回调
   * onFirstLevel，让渲染层立刻显示行星；完整树（含递归与目录大小）随后返回。
   * 目录大小：深度受限的叶子壳用 getDirectorySize 全量统计（唯一的深层遍历）；
   * 已递归的目录用 sumChildren 自底向上累计，避免对同一子树重复遍历。
   */
  private async scanDirectory(
    dirPath: string,
    dirStats: Stats,
    options: ScanOptions,
    depth: number,
    ctx: ScanContext
  ): Promise<FileNode> {
    checkAborted(options)
    // maxDepth 默认 3；0 表示不限制
    const maxDepth = options.maxDepth ?? 3
    const reachLimit = maxDepth > 0 && depth >= maxDepth

    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => [])

    // 分段渲染：首层先发"壳 + 文件"（目录只带 name/path，size 暂为 0）
    if (depth === 1 && options.onFirstLevel) {
      const firstLevel: FileNode[] = []
      for (const entry of entries) {
        checkAborted(options)
        if (!options.includeHidden && entry.name.startsWith('.')) continue
        if (entry.isDirectory() && this.isIgnored(entry.name, options.ignoredFolders)) continue
        const fullPath = join(dirPath, entry.name)
        try {
          if (entry.isDirectory()) {
            firstLevel.push({
              name: entry.name,
              path: fullPath,
              size: 0,
              mtimeMs: 0,
              isDirectory: true
            })
          } else if (entry.isFile()) {
            const fileStats = await stat(fullPath)
            firstLevel.push({
              name: entry.name,
              path: fullPath,
              size: fileStats.size,
              mtimeMs: fileStats.mtimeMs,
              isDirectory: false
            })
          }
        } catch (err) {
          if (err instanceof ScanAbortedError) throw err
          // 跳过无法访问的条目
        }
      }
      options.onFirstLevel({
        name: basename(dirPath),
        path: dirPath,
        size: 0,
        mtimeMs: dirStats.mtimeMs,
        isDirectory: true,
        children: firstLevel
      })
    }

    const children: FileNode[] = []

    for (const entry of entries) {
      checkAborted(options)
      if (!options.includeHidden && entry.name.startsWith('.')) continue
      if (entry.isDirectory() && this.isIgnored(entry.name, options.ignoredFolders)) continue
      const fullPath = join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          const childStats = await stat(fullPath)
          if (reachLimit) {
            // 叶子壳：内容不进树，但必须全量统计大小（半径不因深度截断而失真）
            const shell: FileNode = {
              name: entry.name,
              path: fullPath,
              size: 0,
              mtimeMs: childStats.mtimeMs,
              isDirectory: true
            }
            shell.size = await this.getDirectorySize(fullPath, options, ctx)
            children.push(shell)
          } else {
            const child = await this.scanDirectory(fullPath, childStats, options, depth + 1, ctx)
            // 目录星体大小 = children 自底向上累计（子树已递归完整，免二次遍历）
            child.size = this.sumChildren(child)
            children.push(child)
          }
        } else if (entry.isFile()) {
          const fileStats = await stat(fullPath)
          children.push({
            name: entry.name,
            path: fullPath,
            size: fileStats.size,
            mtimeMs: fileStats.mtimeMs,
            isDirectory: false
          })
          ctx.processed++
          options.onProgress?.(ctx.processed, fullPath)
        }
      } catch (err) {
        if (err instanceof ScanAbortedError) throw err
        // 其余错误跳过无法访问的条目，不中断整体扫描
      }
    }

    return {
      name: basename(dirPath),
      path: dirPath,
      size: 0,
      mtimeMs: dirStats.mtimeMs,
      isDirectory: true,
      children
    }
  }
}
