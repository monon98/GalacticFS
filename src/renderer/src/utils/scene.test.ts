/**
 * 场景工具函数测试：螺旋布局分布、文件大小/时间格式化、缩略图格式判断。
 * 覆盖渲染进程 UI 层的关键纯逻辑。
 */

import { describe, expect, it } from 'vitest'
import {
  canThumbnail,
  computeGalacticCoreRadius,
  formatSize,
  formatTime,
  layoutChildPosition,
  spiralOrbits
} from './scene'
import { getFileKindLabel } from './labels'
import type { FileNode } from '../../../shared/types'

function node(name: string, isDirectory = false): FileNode {
  return { name, path: `C:\\test\\${name}`, size: 100, mtimeMs: 0, isDirectory }
}

describe('spiralOrbits 独轨布局', () => {
  it('不同半径的星体独占不同轨道，且半径越大轨道越靠内（近中央）', () => {
    const radii = [0.3, 0.9, 1.8, 0.6]
    const placements = spiralOrbits(radii, 5)
    // 轨道序号按半径降序分配：1.8→最内、0.3→最外（体积大的星球越靠近中央）
    const byRadius = new Map(
      radii.map((r, i) => [r, Math.hypot(placements[i].position[0], placements[i].position[2])])
    )
    expect(byRadius.get(1.8)).toBeLessThan(byRadius.get(0.9)!)
    expect(byRadius.get(0.9)).toBeLessThan(byRadius.get(0.6)!)
    expect(byRadius.get(0.6)).toBeLessThan(byRadius.get(0.3)!)
    // 四条轨道序号互不相同
    const orbits = new Set(placements.map((p) => p.orbitIndex))
    expect(orbits.size).toBe(4)
  })

  it('相同半径共享一条轨道（小行星带），按黄金角错开', () => {
    const radii = [0.4, 0.4, 0.4, 0.4, 0.4]
    const placements = spiralOrbits(radii, 5)
    const orbits = new Set(placements.map((p) => p.orbitIndex))
    expect(orbits.size).toBe(1)
    // 同轨道任意两球中心距 > 直径（黄金角回绕后最小角度差也不重叠）
    for (let a = 0; a < placements.length; a++) {
      for (let b = a + 1; b < placements.length; b++) {
        const dist = Math.hypot(
          placements[a].position[0] - placements[b].position[0],
          placements[a].position[2] - placements[b].position[2]
        )
        expect(dist).toBeGreaterThan(0.4 * 2)
      }
    }
  })

  it('相邻轨道径向间距 ≥ 两球半径和 + gap（投影不重叠）', () => {
    const radii = [0.3, 0.8, 1.6]
    const placements = spiralOrbits(radii, 5, 0.4)
    // 轨道分配（半径降序）：1.6 最内 → 0.8 → 0.3 最外；各轨道半径按轨道序号排序
    const orbitRadii = placements.map((p) => Math.hypot(p.position[0], p.position[2]))
    const sorted = [...orbitRadii].sort((a, b) => a - b)
    // 相邻轨道差 = 相邻两组半径和 + gap（1.6-0.8 相邻、0.8-0.3 相邻）
    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(1.6 + 0.8 + 0.4 - 1e-6)
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(0.8 + 0.3 + 0.4 - 1e-6)
  })

  it('返回顺序与输入一致、y 恒为 0', () => {
    const radii = [0.2, 1.8, 0.3]
    const placements = spiralOrbits(radii, 5)
    expect(placements).toHaveLength(3)
    // 输入 0 号是小球：输出 0 号轨道半径大于输入 1 号（大球近中央）
    const r0 = Math.hypot(placements[0].position[0], placements[0].position[2])
    const r1 = Math.hypot(placements[1].position[0], placements[1].position[2])
    expect(r0).toBeGreaterThan(r1)
    placements.forEach((p) => expect(p.position[1]).toBe(0))
  })

  it('不同轨道的首颗星相位错开（不排成放射直线）', () => {
    // 三条轨道各一颗：起始角 = phaseOffset × (orbitIndex + 1)，互不相同且不为 0
    const placements = spiralOrbits([0.3, 0.8, 1.6], 5, 0.4, 0.6)
    const angles = placements.map((p) => Math.atan2(p.position[2], p.position[0]))
    const unique = new Set(angles.map((a) => a.toFixed(4)))
    expect(unique.size).toBe(3)
    // 任意两星连线不经过中心（角度不同）
    angles.forEach((a) => expect(Math.abs(Math.sin(a))).toBeGreaterThan(0.01))
  })

  it('maxRadius 封顶：条目极多时并入最外轨道，轨道半径不超过上限', () => {
    // 60 个不同半径：无封顶时轨道半径线性爆炸，封顶后全部落在 [first, maxRadius] 内
    const radii = Array.from({ length: 60 }, (_, i) => 0.3 + i * 0.05)
    const placements = spiralOrbits(radii, 5, 0.4, 0.6, 0.5, 24)
    const maxR = Math.max(...placements.map((p) => Math.hypot(p.position[0], p.position[2])))
    expect(maxR).toBeLessThanOrEqual(24 + 1e-6)
    // 半径种类 60 > 封顶容纳的轨道数：至少存在一条轨道承载多个不同半径的星体（合并发生）
    const orbitCount = new Set(placements.map((p) => p.orbitIndex)).size
    expect(orbitCount).toBeLessThan(60)
  })

  it('maxRadius 足够大时不影响原有布局（默认不封顶）', () => {
    const radii = [0.3, 0.9, 1.8, 0.6]
    const placements = spiralOrbits(radii, 5)
    const orbits = new Set(placements.map((p) => p.orbitIndex))
    expect(orbits.size).toBe(4)
  })
})

describe('computeGalacticCoreRadius 中心最大原则', () => {
  it('子星体更大时中心放大到子星体的 2 倍', () => {
    expect(computeGalacticCoreRadius(1, [2, 1.5])).toBeCloseTo(4)
  })

  it('自身更大（超过子星体的 2 倍）时保持自身半径', () => {
    expect(computeGalacticCoreRadius(4.5, [2, 1])).toBeCloseTo(4.5)
  })

  it('无子星体时保持自身半径', () => {
    expect(computeGalacticCoreRadius(0.8, [])).toBeCloseTo(0.8)
  })
})

describe('子轨道环绕布局', () => {
  it('以星系中心为原点、按给定半径均匀环绕', () => {
    const p0 = layoutChildPosition(0, 4, 2.4)
    const p1 = layoutChildPosition(1, 4, 2.4)
    expect(Math.hypot(p0[0], p0[2])).toBeCloseTo(2.4)
    expect(Math.hypot(p1[0], p1[2])).toBeCloseTo(2.4)
    // 相邻夹角 90°
    const dot = p0[0] * p1[0] + p0[2] * p1[2]
    expect(dot).toBeCloseTo(0, 5)
    expect(p0[1]).toBe(0)
  })
})

describe('formatSize 大小格式化', () => {
  it('B/KB/MB/GB 各档位', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatSize(3 * 1024 * 1024 * 1024)).toBe('3.0 GB')
  })
})

describe('formatTime 时间格式化', () => {
  it('输出 zh-CN 本地时间格式', () => {
    expect(formatTime(new Date(2026, 0, 15, 8, 30).getTime())).toContain('2026')
  })
})

describe('canThumbnail 缩略图格式判断', () => {
  it('图片/视频返回 true', () => {
    expect(canThumbnail(node('photo.png'))).toBe(true)
    expect(canThumbnail(node('movie.mp4'))).toBe(true)
    expect(canThumbnail(node('big.JPG'))).toBe(true)
  })

  it('文档/目录/无扩展名返回 false', () => {
    expect(canThumbnail(node('readme.txt'))).toBe(false)
    expect(canThumbnail(node('folder', true))).toBe(false)
    expect(canThumbnail(node('noext'))).toBe(false)
  })
})

describe('getFileKindLabel 类型标签', () => {
  it('常见扩展名映射为中文类别', () => {
    expect(getFileKindLabel('a.png')).toBe('图片')
    expect(getFileKindLabel('b.avi')).toBe('视频')
    expect(getFileKindLabel('c.pdf')).toBe('文档')
    expect(getFileKindLabel('d.ts')).toBe('代码')
    expect(getFileKindLabel('e.zip')).toBe('压缩包')
    expect(getFileKindLabel('f.xyz')).toBe('其他文件')
  })
})
