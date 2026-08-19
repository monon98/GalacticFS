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
    return this.scanDirectory(rootPath, rootStats, options, 1)
  }

  /** 是否命中忽略列表（精确匹配目录名，大小写不敏感） */
  private isIgnored(name: string, ignored: string[] | undefined): boolean {
    if (!ignored || ignored.length === 0) return false
    const lower = name.toLowerCase()
    return ignored.some((item) => item.toLowerCase() === lower)
  }

  /**
   * 递归统计目录内容总大小（决定星体半径，文档 §6.1 大小→半径）。
   * 不受深度限制（否则统计不完整）；隐藏/忽略规则与扫描一致；
   * 每层检查中断信号，保证中止请求及时生效。
   */
  private async getDirectorySize(dirPath: string, options: ScanOptions): Promise<number> {
    checkAborted(options)
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => [])
    let total = 0
    for (const entry of entries) {
      checkAborted(options)
      if (!options.includeHidden && entry.name.startsWith('.')) continue
      if (entry.isDirectory() && this.isIgnored(entry.name, options.ignoredFolders)) continue
      const fullPath = join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          total += await this.getDirectorySize(fullPath, options)
        } else if (entry.isFile()) {
          const fileStats = await stat(fullPath)
          total += fileStats.size
        }
      } catch (err) {
        // 中断信号优先于单条目错误：继续向外抛
        if (err instanceof ScanAbortedError) throw err
        // 其余错误跳过无法访问的条目
      }
    }
    return total
  }

  /**
   * 递归扫描单个目录。
   * @param depth 当前深度（根为 1）；depth >= maxDepth 时不再展开子目录（children 为空）
   * 分段渲染：depth === 1 时先快速收集直接子项（文件 stat、目录壳 size=0）回调
   * onFirstLevel，让渲染层立刻显示行星；完整树（含递归与目录大小）随后返回。
   */
  private async scanDirectory(
    dirPath: string,
    dirStats: Stats,
    options: ScanOptions,
    depth: number
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
    let scanned = 0

    for (const entry of entries) {
      checkAborted(options)
      if (!options.includeHidden && entry.name.startsWith('.')) continue
      if (entry.isDirectory() && this.isIgnored(entry.name, options.ignoredFolders)) continue
      const fullPath = join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          const childStats = await stat(fullPath)
          const child = reachLimit
            ? {
                name: entry.name,
                path: fullPath,
                size: 0,
                mtimeMs: childStats.mtimeMs,
                isDirectory: true
              }
            : await this.scanDirectory(fullPath, childStats, options, depth + 1)
          // 目录星体大小 = 内容递归统计（不受深度限制，保证半径准确）
          child.size = await this.getDirectorySize(fullPath, options)
          children.push(child)
        } else if (entry.isFile()) {
          const fileStats = await stat(fullPath)
          children.push({
            name: entry.name,
            path: fullPath,
            size: fileStats.size,
            mtimeMs: fileStats.mtimeMs,
            isDirectory: false
          })
          scanned++
          options.onProgress?.(scanned, fullPath)
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
