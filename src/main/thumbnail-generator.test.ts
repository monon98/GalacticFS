/**
 * 缩略图生成器测试：验证文档 §4.6.2 的格式支持判定（纯函数部分）。
 * 生成本身依赖 Electron nativeImage，无法在 node 测试环境运行，由主进程集成时手动验证。
 */

import { describe, expect, it } from 'vitest'
import { isThumbnailSupported } from './thumbnail-generator'

describe('isThumbnailSupported', () => {
  it('支持常见图片格式', () => {
    for (const name of [
      'a.png',
      'b.JPG',
      'c.jpeg',
      'd.gif',
      'e.webp',
      'f.bmp',
      'g.ico',
      'h.tiff'
    ]) {
      expect(isThumbnailSupported(name)).toBe(true)
    }
  })

  it('支持常见视频格式', () => {
    for (const name of ['a.mp4', 'b.mov', 'c.avi', 'd.mkv', 'e.wmv', 'f.flv', 'g.webm', 'h.m4v']) {
      expect(isThumbnailSupported(name)).toBe(true)
    }
  })

  it('不支持文档/代码等格式', () => {
    for (const name of ['a.pdf', 'b.txt', 'c.ts', 'd.zip', 'e.exe']) {
      expect(isThumbnailSupported(name)).toBe(false)
    }
  })

  it('无扩展名不支持', () => {
    expect(isThumbnailSupported('README')).toBe(false)
  })
})
