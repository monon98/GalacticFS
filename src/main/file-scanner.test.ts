/**
 * 文件扫描器测试：用临时目录构造 fixture 验证目录树构建、
 * 隐藏文件过滤、错误容忍与进度回调（文档 §2.1 P0 扫描功能）。
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NodeFsScanner } from './file-scanner'
import type { FileNode } from '../shared/types'

let root: string

// 每个用例前创建独立临时目录作为扫描根，避免用例间相互污染
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'galacticfs-scan-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** 构造三层目录 + 各类文件的 fixture：docs/notes/todo.txt、docs/spec.pdf、images/photo.png、readme.md、隐藏文件 */
async function createTree(): Promise<void> {
  await mkdir(join(root, 'docs'), { recursive: true })
  await mkdir(join(root, 'docs', 'notes'), { recursive: true })
  await mkdir(join(root, 'images'), { recursive: true })
  await writeFile(join(root, 'readme.md'), 'hello')
  await writeFile(join(root, 'docs', 'spec.pdf'), 'x'.repeat(2048))
  await writeFile(join(root, 'docs', 'notes', 'todo.txt'), 'buy milk')
  await writeFile(join(root, 'images', 'photo.png'), Buffer.alloc(1024 * 1024))
  await writeFile(join(root, '.hidden'), 'secret')
  await writeFile(join(root, '.gitignore'), 'node_modules')
}

describe('NodeFsScanner', () => {
  it('空目录返回空 children', async () => {
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)
    expect(tree.isDirectory).toBe(true)
    expect(tree.children).toEqual([])
  })

  it('构建正确的目录树结构与字段', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)

    // 根目录：mkdtemp 名字带随机后缀，只校验前缀
    expect(tree.name.startsWith('galacticfs-scan-')).toBe(true)
    expect(tree.path).toBe(root)
    expect(tree.isDirectory).toBe(true)
    expect(tree.size).toBe(0)

    // 根层应只有可见的 docs/images/readme.md（隐藏文件被过滤）
    const names = tree.children!.map((n) => n.name).sort()
    expect(names).toEqual(['docs', 'images', 'readme.md'])

    const docs = tree.children!.find((n) => n.name === 'docs')!
    expect(docs.isDirectory).toBe(true)
    expect(docs.children!.map((n) => n.name).sort()).toEqual(['notes', 'spec.pdf'])

    const spec = docs.children!.find((n) => n.name === 'spec.pdf')!
    expect(spec.isDirectory).toBe(false)
    expect(spec.size).toBe(2048)
    expect(spec.path).toBe(join(root, 'docs', 'spec.pdf'))

    // 深度 3：notes 位于第三层，其直接文件仍列出（子星系行星），但不递归更深的目录
    const notes = docs.children!.find((n) => n.name === 'notes')!
    expect(notes.children!.map((n) => n.name)).toEqual(['todo.txt'])

    const photo = tree.children!.find((n) => n.name === 'images')!.children![0]
    expect(photo.size).toBe(1024 * 1024)
  })

  it('记录真实修改时间戳', async () => {
    await writeFile(join(root, 'a.txt'), 'x')
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)
    const file = tree.children![0]
    expect(file.mtimeMs).toBeGreaterThan(0)
    expect(Number.isFinite(file.mtimeMs)).toBe(true)
  })

  it('默认排除隐藏文件（点开头）', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)
    expect(tree.children!.map((n) => n.name)).not.toContain('.hidden')
    expect(tree.children!.map((n) => n.name)).not.toContain('.gitignore')
  })

  it('includeHidden 时包含隐藏文件', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root, { includeHidden: true })
    const names = tree.children!.map((n) => n.name)
    expect(names).toContain('.hidden')
    expect(names).toContain('.gitignore')
  })

  it('默认深度 3：第三层目录的文件可见，更深层不可达', async () => {
    const deep = join(root, 'a', 'b', 'c', 'd')
    await mkdir(deep, { recursive: true })
    await writeFile(join(deep, 'leaf.txt'), 'deep')
    await writeFile(join(root, 'a', 'b', 'mid.txt'), 'mid')
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)

    const a = tree.children![0]
    const b = a.children!.find((n) => n.name === 'b')!

    // b(3) 的文件可见（子星系行星），子目录 c(4) 作为空壳列出但不展开
    expect(b.children!.map((n) => n.name)).toEqual(['c', 'mid.txt'])
    const c = b.children!.find((n) => n.name === 'c')!
    expect(c.children ?? []).toEqual([])
  })

  it('maxDepth 0 时不限制深度（保留全量递归能力）', async () => {
    const deep = join(root, 'a', 'b', 'c', 'd')
    await mkdir(deep, { recursive: true })
    await writeFile(join(deep, 'leaf.txt'), 'deep')
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root, { maxDepth: 0 })
    const leaf = tree.children![0].children![0].children![0].children![0].children![0]
    expect(leaf.name).toBe('leaf.txt')
  })

  it('忽略列表中的目录名不进入结果', async () => {
    await mkdir(join(root, 'node_modules'))
    await mkdir(join(root, 'src'))
    await mkdir(join(root, '.git'))
    await writeFile(join(root, 'node_modules', 'x.js'), 'x')
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root, { ignoredFolders: ['node_modules', '.git'] })
    const names = tree.children!.map((n) => n.name)
    expect(names).toContain('src')
    expect(names).not.toContain('node_modules')
    expect(names).not.toContain('.git')
  })

  it('忽略匹配大小写不敏感', async () => {
    await mkdir(join(root, 'NODE_MODULES'))
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root, { ignoredFolders: ['node_modules'] })
    expect(tree.children!.map((n) => n.name)).not.toContain('NODE_MODULES')
  })

  it('目录 size 为内容递归统计（决定星体半径）', async () => {
    await mkdir(join(root, 'docs'), { recursive: true })
    await writeFile(join(root, 'docs', 'a.txt'), 'x'.repeat(100))
    await mkdir(join(root, 'docs', 'sub'))
    await writeFile(join(root, 'docs', 'sub', 'b.txt'), 'y'.repeat(200))
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)
    const docs = tree.children!.find((n) => n.name === 'docs')!
    // 100 + 200 = 300（含第三层 sub 的内容，不受深度限制）
    expect(docs.size).toBe(300)
  })

  it('目录 size 统计同样应用隐藏/忽略规则', async () => {
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src', 'main.js'), 'x'.repeat(50))
    await mkdir(join(root, 'src', 'node_modules'))
    await writeFile(join(root, 'src', 'node_modules', 'big.js'), 'y'.repeat(5000))
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root, { ignoredFolders: ['node_modules'] })
    const src = tree.children!.find((n) => n.name === 'src')!
    expect(src.size).toBe(50)
  })

  it('不存在的路径抛出明确错误', async () => {
    const scanner = new NodeFsScanner()
    await expect(scanner.scan(join(root, 'missing'))).rejects.toThrow(/ENOENT|missing/)
  })

  it('进度回调收到扫描计数', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    const counts: number[] = []
    await scanner.scan(root, { onProgress: (scanned) => counts.push(scanned) })
    expect(counts.length).toBeGreaterThan(0)
    expect(counts[counts.length - 1]).toBeGreaterThan(0)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    }
  })

  it('文件系统错误不会中断整个扫描', async () => {
    await writeFile(join(root, 'ok.txt'), 'fine')
    const broken = join(root, 'broken-link')
    await mkdir(broken)
    const scanner = new NodeFsScanner()
    const tree = await scanner.scan(root)
    expect(tree.children!.map((n) => n.name)).toContain('ok.txt')
  })

  it('中断信号：aborted 后抛出 ScanAbortedError', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    const controller = new AbortController()
    controller.abort()
    await expect(scanner.scan(root, { signal: controller.signal })).rejects.toThrow('Scan aborted')
  })

  it('首层回调：onFirstLevel 收到壳目录 + 完整文件，且早于完整树返回', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    let firstLevel: FileNode | null = null
    // 首层回调触发后立即记录：此时文件已齐（stat 完成），目录为壳（size = 0）
    const tree = await scanner.scan(root, {
      onFirstLevel: (partial) => {
        firstLevel = partial
      }
    })
    expect(firstLevel).not.toBeNull()
    // 首层回调内容：可见文件齐全（readme.md），目录是壳（size 0、无 children）
    const partialNames = firstLevel!.children!.map((n) => n.name).sort()
    expect(partialNames).toEqual(['docs', 'images', 'readme.md'])
    const docsShell = firstLevel!.children!.find((n) => n.name === 'docs')!
    expect(docsShell.isDirectory).toBe(true)
    expect(docsShell.size).toBe(0)
    expect(docsShell.children).toBeUndefined()
    // 完整树中 docs 已有递归结构与真实 size
    const docsFull = tree.children!.find((n) => n.name === 'docs')!
    expect(docsFull.children!.length).toBeGreaterThan(0)
    expect(docsFull.size).toBeGreaterThan(0)
  })

  it('中断信号：扫描中途 abort 也能中断（不返回结果）', async () => {
    await createTree()
    const scanner = new NodeFsScanner()
    const controller = new AbortController()
    // 首层就绪后立即中止，模拟"切换目录"场景
    const promise = scanner.scan(root, {
      onFirstLevel: () => controller.abort(),
      signal: controller.signal
    })
    await expect(promise).rejects.toThrow('Scan aborted')
  })
})
