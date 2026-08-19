/**
 * 缩略图缓存：基于 better-sqlite3 的磁盘缓存（文档 §4.6）。
 * 表结构 thumbnails(file_path 主键, file_modified, thumbnail_data, width, height)，
 * 主键查询命中 <10ms；缓存膨胀时用 prune 按修改时间清理最旧条目。
 * 使用方式：new ThumbnailDB(dbPath)，用完必须 close()。
 */

import Database from 'better-sqlite3'

/** 缓存条目（不含主键 file_path，供 IPC 层返回给渲染进程） */
export interface CachedThumbnail {
  /** PNG 二进制数据 */
  data: Buffer
  width: number
  height: number
  /** 生成缩略图时的文件修改时间，用于判断缓存是否过期 */
  fileModified: number
}

export class ThumbnailDB {
  private db: Database.Database

  /**
   * @param dbPath SQLite 数据库文件路径（需可写目录，如 app.getPath('userData')/thumbnails.db）
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
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

  /**
   * 查询缓存条目。
   * @param filePath 文件绝对路径
   * @returns 缓存条目；未命中返回 undefined。
   * 注意：文件修改时间与 fileModified 不一致时视为过期，由调用方判断后重新生成
   */
  get(filePath: string): CachedThumbnail | undefined {
    const row = this.db
      .prepare(
        'SELECT file_modified, thumbnail_data, width, height FROM thumbnails WHERE file_path = ?'
      )
      .get(filePath) as
      { file_modified: number; thumbnail_data: Buffer; width: number; height: number } | undefined
    if (!row) return undefined
    return {
      data: row.thumbnail_data,
      width: row.width,
      height: row.height,
      fileModified: row.file_modified
    }
  }

  /**
   * 写入/覆盖缓存条目（同路径重复写入按 UPSERT 语义替换）。
   * @param filePath 文件绝对路径
   * @param fileModified 生成缩略图时的文件 mtime
   * @param data 缩略图 PNG 数据
   * @param width 缩略图宽度
   * @param height 缩略图高度
   */
  set(filePath: string, fileModified: number, data: Buffer, width: number, height: number): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO thumbnails (file_path, file_modified, thumbnail_data, width, height)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(filePath, fileModified, data, width, height)
  }

  /**
   * 清理超出上限的最旧条目（按 file_modified 升序删除），防止数据库膨胀。
   * @param maxEntries 允许的最大条目数
   * @returns 实际删除的条目数
   */
  prune(maxEntries: number): number {
    const total = this.count()
    const excess = total - maxEntries
    if (excess <= 0) return 0
    const result = this.db
      .prepare(
        'DELETE FROM thumbnails WHERE file_path IN (SELECT file_path FROM thumbnails ORDER BY file_modified LIMIT ?)'
      )
      .run(excess)
    return result.changes
  }

  /** 清空全部缓存 */
  clear(): void {
    this.db.exec('DELETE FROM thumbnails')
  }

  /** 当前缓存条目总数 */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM thumbnails').get() as {
      count: number
    }
    return row.count
  }

  /** 关闭数据库连接（应用退出或测试结束时调用） */
  close(): void {
    this.db.close()
  }
}
