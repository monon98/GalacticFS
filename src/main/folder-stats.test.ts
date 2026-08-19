/**
 * 目录统计模块测试：格式分布计数、隐藏/忽略规则、深度不受限制。
 * 用临时目录 fixture 验证 collectFolderStats 的完整统计行为。
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectFolderStats } from './folder-stats'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'galacticfs-stats-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('collectFolderStats', () => {
  it('统计各种扩展名的文件数量与大小（含深层目录）', async () => {
    await writeFile(join(root, 'a.png'), 'x'.repeat(100))
    await writeFile(join(root, 'b.PNG'), 'y'.repeat(200))
    await mkdir(join(root, 'sub'))
    await writeFile(join(root, 'sub', 'c.txt'), 'z'.repeat(300))
    await writeFile(join(root, 'sub', 'd.js'), 'w'.repeat(50))

    const stats = await collectFolderStats(root)
    expect(stats.totalFiles).toBe(4)
    expect(stats.totalSize).toBe(650)

    // 扩展名大小写合并；按数量降序
    expect(stats.byExtension).toEqual([
      { ext: 'png', count: 2, size: 300 },
      { ext: 'txt', count: 1, size: 300 },
      { ext: 'js', count: 1, size: 50 }
    ])
  })

  it('无扩展名文件归入占位分组', async () => {
    await writeFile(join(root, 'noext'), 'x')
    const stats = await collectFolderStats(root)
    expect(stats.byExtension[0].ext).toBe('(无扩展名)')
    expect(stats.byExtension[0].count).toBe(1)
  })

  it('忽略列表中的目录不计入', async () => {
    await writeFile(join(root, 'a.txt'), 'x')
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'node_modules', 'big.js'), 'y'.repeat(5000))
    const stats = await collectFolderStats(root, { ignoredFolders: ['node_modules'] })
    expect(stats.totalFiles).toBe(1)
    expect(stats.totalSize).toBe(1)
  })

  it('默认忽略隐藏文件，includeHidden 时包含', async () => {
    await writeFile(join(root, '.hidden'), 'x')
    await writeFile(join(root, 'visible.txt'), 'y')
    const without = await collectFolderStats(root)
    expect(without.totalFiles).toBe(1)

    const withHidden = await collectFolderStats(root, { includeHidden: true })
    expect(withHidden.totalFiles).toBe(2)
  })

  it('空目录返回全零统计', async () => {
    const stats = await collectFolderStats(root)
    expect(stats).toEqual({ totalFiles: 0, totalSize: 0, byExtension: [] })
  })
})
