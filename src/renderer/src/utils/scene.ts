/**
 * 场景布局工具：将目录下的条目分布到 3D 场景（太阳系分层结构）。
 * 文件 = 近轨行星、文件夹 = 远轨子星系（子轨道环绕其文件）。
 * 布局核心 spiralOrbits：每颗星体独享一条轨道（径向错开、角度黄金角错开），
 * 相同半径的星体共享轨道形成"小行星带"；大星体外轨、小星体内轨。
 * 星系核半径由 computeGalacticCoreRadius 保证"中心星体最大"。
 */

import type { FileNode } from '../../../shared/types'

export type Vec3 = [number, number, number]

/** 黄金角（弧度）：同轨道相邻条目的夹角，任意数量下分布均匀且互不重叠 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** 布局结果：位置 + 所在轨道序号 */
export interface OrbitPlacement {
  position: [number, number, number]
  orbitIndex: number
}

/**
 * djb2 字符串哈希：从路径生成稳定伪随机种子（同路径每次渲染结果一致，
 * 保证自转/公转速度在重渲染间不变，不会每帧抖动）。
 * @param seed 任意字符串（通常为节点路径）
 * @returns 0 ~ 2^31 的非负整数
 */
export function hashSeed(seed: string): number {
  let hash = 5381
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * 稳定随机速度因子：基于路径哈希，范围 [0.6, 1.4]。
 * 用于让每颗星的自转/公转速度互不相同（"随机"），但同路径恒定。
 * @param seed 任意字符串（通常为节点路径）
 */
export function speedFactor(seed: string): number {
  return 0.6 + ((hashSeed(seed) % 100) / 100) * 0.8
}

/**
 * 螺旋独轨布局：按半径分组，每组（相同半径）独占一条轨道。
 * 轨道间径向间距 = 相邻两组半径和 + angularGap（球面投影不重叠）；
 * 同轨道内以黄金角为基础加随机扰动（jitter）——位置随机但最小角度差有下限，
 * 保证任何球不重叠（最小角度差 ≥ 黄金角 − 扰动幅度，弦距恒大于最大球直径）。
 * 每条轨道的起始相位随轨道序号递增（phaseOffset），避免星体从中心呈放射直线排列。
 * 大星体分配内轨（越靠近中央）、小星体外轨——"体积大的星球越靠近中心"的用户偏好。
 * 条目极多时（数百个文件）轨道半径会线性爆炸：用 maxRadius 封顶——达到上限后
 * 剩余组并入最后一条轨道（黄金角在任意数量下均匀分布，弦距 = 2R·sin(Δθ/2) 恒大于
 * 最大球直径，不重叠）。这样文件带半径受限，不会与外围星系带（40 起）交错。
 * @param radii 每项的星体半径（长度 = 条目数）
 * @param firstOrbitRadius 第一条（最内）轨道半径
 * @param angularGap 相邻轨道间的最小径向间距
 * @param phaseOffset 轨道间起始相位错开量（弧度，每轨道递增）
 * @param jitter 同轨道内角度随机扰动幅度（弧度，±jitter/2）
 * @param maxRadius 最外轨道半径上限（封顶后多余组并入最外轨道；Infinity = 不限）
 * @returns 与输入顺序对应的位置数组
 */
export function spiralOrbits(
  radii: number[],
  firstOrbitRadius: number,
  angularGap = 0.4,
  phaseOffset = 0.6,
  jitter = 0.5,
  maxRadius = Infinity
): OrbitPlacement[] {
  // 按半径分组：相同半径共享一条轨道（等价"小行星带"）
  const groups = new Map<number, number[]>()
  radii.forEach((radius, index) => {
    const list = groups.get(radius)
    if (list) list.push(index)
    else groups.set(radius, [index])
  })
  // 半径降序：大球先占最内轨道（近中央），小球依次向外——"体积大的星球越靠近中央"
  const sortedRadii = [...groups.keys()].sort((a, b) => b - a)
  const placements: OrbitPlacement[] = []
  let orbitRadius = firstOrbitRadius
  let prevRadius = 0
  let capped = false
  let orbitSeq = 0
  sortedRadii.forEach((radius) => {
    // 封顶后所有组共用最外轨道（半径 = maxRadius，黄金角继续均分）
    if (!capped) {
      const next = orbitSeq > 0 ? orbitRadius + prevRadius + radius + angularGap : orbitRadius
      if (next > maxRadius) {
        capped = true
        orbitRadius = maxRadius
      } else {
        orbitRadius = next
      }
    }
    const indices = groups.get(radius)!
    // 随机扰动：每条轨道生成一组 ±jitter/2 的偏移量（观察者视角"随机分布"）
    const jitters = indices.map(() => (Math.random() - 0.5) * jitter)
    indices.forEach((index, k) => {
      // 相位错开 + 黄金角 + 随机扰动：同轨道内均匀中带随机、跨轨道不共线
      const angle = phaseOffset * (orbitSeq + 1) + k * GOLDEN_ANGLE + jitters[k]
      placements[index] = {
        position: [Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius],
        orbitIndex: orbitSeq
      }
    })
    prevRadius = radius
    if (!capped) orbitSeq++
  })
  return placements
}

/**
 * 计算星系核（中心星体）半径：必须大于所有子星体（中心最大原则）。
 * 取"子星体中最大半径 × 2.0"与"自身大小半径"的较大值（放大系数 2.0 让星系中心星视觉更突出）。
 * @param ownRadius 星系核自身大小映射的半径
 * @param childRadii 子星体（文件/子星系）的半径数组
 */
export function computeGalacticCoreRadius(ownRadius: number, childRadii: number[]): number {
  const maxChild = childRadii.reduce((max, r) => Math.max(max, r), 0)
  return Math.max(ownRadius, maxChild * 2.0)
}

/**
 * 子星系内文件位置：以星系中心为原点、小半径环绕分布（角度均匀）。
 * @param index 文件序号
 * @param total 文件总数
 * @param childOrbitRadius 环绕半径（由星系星体半径决定，保证在星环之外）
 */
export function layoutChildPosition(index: number, total: number, childOrbitRadius: number): Vec3 {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + Math.PI / 2
  return [Math.cos(angle) * childOrbitRadius, 0, Math.sin(angle) * childOrbitRadius]
}

/** 格式化文件大小为人类可读字符串（B/KB/MB/GB） */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/** 格式化时间戳为本地日期字符串 */
export function formatTime(mtimeMs: number): string {
  return new Date(mtimeMs).toLocaleString('zh-CN', { hour12: false })
}

/** 渲染进程侧的缩略图格式判断（与主进程 thumbnail-generator 保持一致） */
const THUMBNAIL_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.ico',
  '.tiff',
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v'
])

/** 判断文件是否值得请求缩略图（仅图片/视频，避免无效 IPC 洪峰） */
export function canThumbnail(node: FileNode): boolean {
  if (node.isDirectory) return false
  const dotIndex = node.name.lastIndexOf('.')
  if (dotIndex <= 0) return false
  return THUMBNAIL_EXTENSIONS.has(node.name.slice(dotIndex).toLowerCase())
}
