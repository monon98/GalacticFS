/**
 * 缩略图缓存测试：验证 get/set 读写、覆盖、持久化、
 * prune 按修改时间清理最旧条目与 clear/count（文档 §4.6 缓存设计）。
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThumbnailDB } from './thumbnail-db'

let dir: string
let dbPath: string
let db: ThumbnailDB

// 每个用例独立临时数据库文件，afterEach 关闭并删除
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'galacticfs-thumbs-'))
  dbPath = join(dir, 'thumbnails.db')
  db = new ThumbnailDB(dbPath)
})

afterEach(async () => {
  db.close()
  await rm(dir, { recursive: true, force: true })
})

describe('ThumbnailDB', () => {
  it('未缓存路径返回 undefined', () => {
    expect(db.get('C:\\nonexistent\\a.png')).toBeUndefined()
  })

  it('set 后 get 返回相同数据', () => {
    const data = Buffer.from([1, 2, 3, 4, 5])
    db.set('/photos/1.png', 123456, data, 256, 256)
    const entry = db.get('/photos/1.png')
    expect(entry).toBeDefined()
    expect(entry!.data).toEqual(data)
    expect(entry!.width).toBe(256)
    expect(entry!.height).toBe(256)
    expect(entry!.fileModified).toBe(123456)
  })

  it('再次 set 覆盖旧条目', () => {
    db.set('/photos/1.png', 100, Buffer.from([1]), 64, 64)
    db.set('/photos/1.png', 200, Buffer.from([9, 9]), 128, 128)
    const entry = db.get('/photos/1.png')
    expect(entry!.fileModified).toBe(200)
    expect(entry!.data).toEqual(Buffer.from([9, 9]))
  })

  it('支持 UTF-8 与特殊字符路径', () => {
    const path = join(dir, '照片 测试 (1) & 图.png')
    db.set(path, 1, Buffer.from([7]), 32, 32)
    expect(db.get(path)!.data).toEqual(Buffer.from([7]))
  })

  it('数据跨连接持久化', () => {
    db.set('/photos/persist.png', 42, Buffer.from([8, 8, 8]), 16, 16)
    db.close()
    // 模拟应用重启：重新打开同一数据库文件应能读到之前的缓存
    const reopened = new ThumbnailDB(dbPath)
    const entry = reopened.get('/photos/persist.png')
    expect(entry!.data).toEqual(Buffer.from([8, 8, 8]))
    reopened.close()
  })

  it('空数据与零尺寸可存储', () => {
    db.set('/photos/empty.png', 0, Buffer.alloc(0), 0, 0)
    const entry = db.get('/photos/empty.png')
    expect(entry!.data.length).toBe(0)
  })

  it('prune 超出上限时清理最旧条目', () => {
    for (let i = 0; i < 12; i++) {
      db.set(`/photos/f${i}.png`, i, Buffer.from([i]), 8, 8)
    }
    const removed = db.prune(10)
    expect(removed).toBe(2)
    // 最早写入（file_modified 最小）的两条被删，最新的仍在
    expect(db.get('/photos/f0.png')).toBeUndefined()
    expect(db.get('/photos/f1.png')).toBeUndefined()
    expect(db.get('/photos/f11.png')).toBeDefined()
  })

  it('prune 未超限时不删除任何条目', () => {
    for (let i = 0; i < 5; i++) {
      db.set(`/photos/f${i}.png`, i, Buffer.from([i]), 8, 8)
    }
    expect(db.prune(10)).toBe(0)
    expect(db.get('/photos/f4.png')).toBeDefined()
  })

  it('clear 清空全部缓存', () => {
    db.set('/photos/a.png', 1, Buffer.from([1]), 8, 8)
    db.set('/photos/b.png', 2, Buffer.from([2]), 8, 8)
    db.clear()
    expect(db.get('/photos/a.png')).toBeUndefined()
    expect(db.get('/photos/b.png')).toBeUndefined()
  })

  it('统计缓存条目数', () => {
    db.set('/photos/a.png', 1, Buffer.from([1]), 8, 8)
    db.set('/photos/b.png', 2, Buffer.from([2]), 8, 8)
    expect(db.count()).toBe(2)
  })
})
