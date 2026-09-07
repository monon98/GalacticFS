/**
 * 配置管理测试：验证默认值、磁盘持久化、最近路径去重/裁剪（文档 §五）。
 * 每个用例注入独立临时 cwd，避免污染真实用户配置。
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigStore } from './config-store'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'galacticfs-config-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ConfigStore', () => {
  it('提供默认配置值', () => {
    const store = new ConfigStore({ cwd: dir })
    // 默认根路径应回退到系统用户主目录（文档 §2.1：默认扫描用户主目录）
    expect(store.defaultRootPath).toBe(process.env.USERPROFILE || process.env.HOME || '/')
    expect(store.lastOpenedPath).toBe('')
    expect(store.recentPaths).toEqual([])
    expect(store.windowBounds).toEqual({ width: 1280, height: 800 })
  })

  it('配置变更后持久化到磁盘', () => {
    const store = new ConfigStore({ cwd: dir })
    store.setDefaultRootPath('D:\\Files')
    store.setWindowBounds({ width: 900, height: 600 })
    // 重新打开实例（模拟重启）后配置仍在
    const reopened = new ConfigStore({ cwd: dir })
    expect(reopened.defaultRootPath).toBe('D:\\Files')
    expect(reopened.windowBounds).toEqual({ width: 900, height: 600 })
  })

  it('setLastOpenedPath 将路径插入最近列表头部', () => {
    const store = new ConfigStore({ cwd: dir })
    store.setLastOpenedPath('/a')
    store.setLastOpenedPath('/b')
    expect(store.recentPaths).toEqual(['/b', '/a'])
    expect(store.lastOpenedPath).toBe('/b')
  })

  it('重复路径去重并置顶', () => {
    const store = new ConfigStore({ cwd: dir })
    store.setLastOpenedPath('/a')
    store.setLastOpenedPath('/b')
    store.setLastOpenedPath('/a')
    expect(store.recentPaths).toEqual(['/a', '/b'])
  })

  it('最近列表最多保留 10 条', () => {
    const store = new ConfigStore({ cwd: dir })
    for (let i = 1; i <= 12; i++) {
      store.setLastOpenedPath(`/dir-${i}`)
    }
    expect(store.recentPaths.length).toBe(10)
    expect(store.recentPaths[0]).toBe('/dir-12')
    expect(store.recentPaths).not.toContain('/dir-1')
    expect(store.recentPaths).not.toContain('/dir-2')
  })

  it('支持自定义默认根路径', () => {
    const store = new ConfigStore({ cwd: dir, defaults: { defaultRootPath: 'C:\\Custom' } })
    expect(store.defaultRootPath).toBe('C:\\Custom')
  })
})
