/**
 * 视觉映射模块测试：覆盖文档 §6.1 的映射规则
 * （扩展名→类型、类型→颜色、大小→半径对数缩放、修改时间→发光强度）。
 */

import { describe, expect, it } from 'vitest'
import {
  FILE_KIND_COLORS,
  getFileColor,
  getFileKind,
  getGlowIntensity,
  getPlanetRadius
} from '../shared/visual-mapping'

describe('getFileKind', () => {
  it('识别常见图片扩展名', () => {
    for (const name of ['a.png', 'b.jpg', 'c.jpeg', 'd.gif', 'e.webp', 'f.bmp', 'g.tiff']) {
      expect(getFileKind(name)).toBe('image')
    }
  })

  it('识别常见视频扩展名', () => {
    for (const name of ['a.mp4', 'b.mov', 'c.avi', 'd.mkv', 'e.webm', 'f.flv']) {
      expect(getFileKind(name)).toBe('video')
    }
  })

  it('识别常见文档扩展名', () => {
    for (const name of [
      'a.pdf',
      'b.doc',
      'c.docx',
      'd.xls',
      'e.xlsx',
      'f.ppt',
      'g.pptx',
      'h.txt',
      'i.md'
    ]) {
      expect(getFileKind(name)).toBe('document')
    }
  })

  it('识别常见代码扩展名', () => {
    for (const name of [
      'a.ts',
      'b.tsx',
      'c.js',
      'd.jsx',
      'e.py',
      'f.rs',
      'g.go',
      'h.java',
      'i.json',
      'j.html',
      'k.css'
    ]) {
      expect(getFileKind(name)).toBe('code')
    }
  })

  it('识别压缩包扩展名', () => {
    for (const name of ['a.zip', 'b.rar', 'c.7z', 'd.tar', 'e.gz', 'f.xz']) {
      expect(getFileKind(name)).toBe('archive')
    }
  })

  it('扩展名大小写不敏感', () => {
    expect(getFileKind('PHOTO.PNG')).toBe('image')
    expect(getFileKind('Report.PDF')).toBe('document')
  })

  it('未知扩展名归为 other', () => {
    expect(getFileKind('data.xyz')).toBe('other')
  })

  it('无扩展名归为 other', () => {
    expect(getFileKind('README')).toBe('other')
  })

  it('隐藏文件按扩展名判断', () => {
    expect(getFileKind('.gitignore')).toBe('other')
    expect(getFileKind('.env')).toBe('other')
  })
})

describe('getPlanetRadius', () => {
  it('0 字节为最小半径 0.2', () => {
    expect(getPlanetRadius(0)).toBe(0.2)
  })

  it('1TB 达到最大半径 3.0', () => {
    expect(getPlanetRadius(10 ** 12)).toBe(3.0)
  })

  it('半径随大小单调不减', () => {
    let prev = getPlanetRadius(0)
    for (let size = 1; size <= 10 ** 12; size *= 10) {
      const radius = getPlanetRadius(size)
      expect(radius).toBeGreaterThanOrEqual(prev)
      prev = radius
    }
  })

  it('文件翻倍后半径更大', () => {
    expect(getPlanetRadius(2048)).toBeGreaterThan(getPlanetRadius(1024))
  })

  it('超大文件被钳制在 3.0 以内', () => {
    expect(getPlanetRadius(10 ** 15)).toBeLessThanOrEqual(3.0)
  })

  it('半径始终在 [0.2, 3.0] 区间', () => {
    for (const size of [0, 1, 1024, 1024 * 1024, 10 ** 9, 10 ** 12]) {
      const radius = getPlanetRadius(size)
      expect(radius).toBeGreaterThanOrEqual(0.2)
      expect(radius).toBeLessThanOrEqual(3.0)
    }
  })
})

describe('getGlowIntensity', () => {
  // 固定"当前时间"便于验证边界：2026-08-18
  const now = Date.UTC(2026, 7, 18)
  const day = 24 * 60 * 60 * 1000

  it('一周内修改为 bright（高亮）', () => {
    expect(getGlowIntensity(now - 3 * day, now)).toBe('bright')
  })

  it('恰好 7 天为 bright', () => {
    expect(getGlowIntensity(now - 7 * day, now)).toBe('bright')
  })

  it('一月内修改为 normal（正常）', () => {
    expect(getGlowIntensity(now - 20 * day, now)).toBe('normal')
  })

  it('恰好 30 天为 normal', () => {
    expect(getGlowIntensity(now - 30 * day, now)).toBe('normal')
  })

  it('超过一月为 dim（暗淡）', () => {
    expect(getGlowIntensity(now - 90 * day, now)).toBe('dim')
  })

  it('未来时间戳为 bright', () => {
    expect(getGlowIntensity(now + day, now)).toBe('bright')
  })
})

describe('getFileColor', () => {
  it('每种类型都有颜色', () => {
    for (const kind of Object.keys(FILE_KIND_COLORS)) {
      expect(getFileColor(kind as keyof typeof FILE_KIND_COLORS)).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('不同类型颜色互不相同', () => {
    const colors = Object.values(FILE_KIND_COLORS)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('映射表导出所有类型', () => {
    expect(Object.keys(FILE_KIND_COLORS).sort()).toEqual([
      'archive',
      'code',
      'document',
      'image',
      'other',
      'video'
    ])
  })
})
