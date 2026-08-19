/**
 * 目录统计模块：递归统计文件夹内的文件格式分布（选中文件夹时展示）。
 * 与扫描器共享隐藏/忽略规则；不受扫描深度限制（统计需要完整数据）。
 */

import { readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

/** 单种扩展名的统计结果 */
export interface ExtensionStat {
  /** 扩展名（小写，不含点号；无扩展名用 "(无扩展名)"） */
  ext: string
  count: number
  size: number
}

/** 目录统计结果 */
export interface FolderStats {
  totalFiles: number
  totalSize: number
  /** 按数量降序的格式分布 */
  byExtension: ExtensionStat[]
}

export interface FolderStatsOptions {
  includeHidden?: boolean
  ignoredFolders?: string[]
}

/** 无扩展名文件的占位键 */
const NO_EXTENSION = '(无扩展名)'

/**
 * 递归统计目录：遍历全部子项（不受深度限制）。
 * 单条目错误（权限不足等）会被吞掉，保证统计不中断。
 * @param dirPath 要统计的目录绝对路径
 * @param options 隐藏/忽略规则（与扫描器一致）
 * @returns 文件总数、总大小与格式分布（按数量降序）
 */
export async function collectFolderStats(
  dirPath: string,
  options: FolderStatsOptions = {}
): Promise<FolderStats> {
  const counts = new Map<string, { count: number; size: number }>()
  let totalFiles = 0
  let totalSize = 0

  const ignored = (options.ignoredFolders ?? []).map((item) => item.toLowerCase())

  const walk = async (path: string): Promise<void> => {
    const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!options.includeHidden && entry.name.startsWith('.')) continue
      const fullPath = join(path, entry.name)
      try {
        if (entry.isDirectory()) {
          if (ignored.includes(entry.name.toLowerCase())) continue
          await walk(fullPath)
        } else if (entry.isFile()) {
          const fileStats = await stat(fullPath)
          totalFiles++
          totalSize += fileStats.size
          const ext = extname(entry.name).slice(1).toLowerCase() || NO_EXTENSION
          const current = counts.get(ext) ?? { count: 0, size: 0 }
          current.count++
          current.size += fileStats.size
          counts.set(ext, current)
        }
      } catch {
        // 跳过无法访问的条目
      }
    }
  }

  await walk(dirPath)

  const byExtension = [...counts.entries()]
    .map(([ext, { count, size }]) => ({ ext, count, size }))
    .sort((a, b) => b.count - a.count || b.size - a.size)

  return { totalFiles, totalSize, byExtension }
}
