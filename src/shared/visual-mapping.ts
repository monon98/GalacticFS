/**
 * 视觉映射模块：将文件属性映射为 3D 宇宙场景的视觉参数。
 * 依据 docs/GalacticFS.md §6.1：类型→颜色、大小→半径（对数缩放）、修改时间→发光强度。
 * 纯函数，无副作用，供渲染进程与测试直接使用。
 */

export type FileKind = 'image' | 'video' | 'document' | 'code' | 'archive' | 'other'

/** 扩展名 → 文件类型映射表（键为小写扩展名，不含点号） */
const EXTENSION_KINDS: Record<string, FileKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  tiff: 'image',
  svg: 'image',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  flv: 'video',
  wmv: 'video',
  m4v: 'video',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  xls: 'document',
  xlsx: 'document',
  ppt: 'document',
  pptx: 'document',
  txt: 'document',
  md: 'document',
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  py: 'code',
  rs: 'code',
  go: 'code',
  java: 'code',
  json: 'code',
  html: 'code',
  css: 'code',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  xz: 'archive',
  bz2: 'archive'
}

/** 文件类型 → 星球颜色（图片=绿、视频=蓝、文档=橙、代码=紫、压缩包=红、其他=灰） */
export const FILE_KIND_COLORS: Record<FileKind, string> = {
  image: '#4CAF50',
  video: '#2196F3',
  document: '#FF9800',
  code: '#9C27B0',
  archive: '#F44336',
  other: '#9E9E9E'
}

/** 文件星球统一颜色（用户偏好：文件不分类型颜色，统一中性色，靠预览图区分） */
export const FILE_COLOR = '#8B9DA8'

/** 目录星体的层级配色：1 = 一级子目录（远轨星系，红橙），2 = 二级目录（星系核，深红橙）。
 * 用户偏好：根目录恒星为红色，子目录星系为红橙色系。 */
export const DIR_LEVEL_COLORS: Record<number, string> = {
  1: '#FF6B35',
  2: '#D9542B'
}

/**
 * 获取指定层级的目录星体颜色。
 * @param level 目录层级（1 起）；未知层级回退到一级配色
 * @returns 十六进制颜色字符串
 */
export function getDirColor(level: number): string {
  return DIR_LEVEL_COLORS[level] ?? DIR_LEVEL_COLORS[1]
}

/**
 * 根据文件名（含扩展名）推断文件类型。
 * @param fileName 文件名，扩展名大小写不敏感
 * @returns 对应 FileKind；无扩展名、隐藏文件或未知扩展名返回 'other'
 */
export function getFileKind(fileName: string): FileKind {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return 'other'
  return EXTENSION_KINDS[fileName.slice(dotIndex + 1).toLowerCase()] ?? 'other'
}

/**
 * 获取指定文件类型的星球颜色。
 * @param kind 文件类型
 * @returns 十六进制颜色字符串
 */
export function getFileColor(kind: FileKind): string {
  return FILE_KIND_COLORS[kind]
}

const MIN_RADIUS = 0.2
const MAX_RADIUS = 3.0
/** 半径达到上限对应的文件大小（1TB），更大文件被钳制在最大半径 */
const MAX_SCANNABLE_SIZE = 10 ** 12

/**
 * 将文件大小映射为星球半径（对数缩放，文档 §6.1：0.2~3.0 单位）。
 * 采用 log10 缩放而非线性，避免大文件挤占场景空间；
 * 结果钳制在 [0.2, 3.0] 区间。
 * @param sizeBytes 文件大小（字节），0 或负数返回最小半径
 * @returns 半径值，范围 [0.2, 3.0]
 */
export function getPlanetRadius(sizeBytes: number): number {
  if (sizeBytes <= 0) return MIN_RADIUS
  const normalized = Math.log10(sizeBytes + 1) / Math.log10(MAX_SCANNABLE_SIZE)
  return Math.min(MAX_RADIUS, MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * normalized)
}

export type GlowIntensity = 'bright' | 'normal' | 'dim'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/**
 * 根据文件修改时间计算发光强度（文档 §6.1）。
 * 1 周内修改 → bright（高亮），1 月内 → normal（正常），更久 → dim（暗淡）。
 * @param mtimeMs 文件修改时间戳（毫秒）
 * @param nowMs 当前时间戳（毫秒），测试时可注入固定值
 * @returns 发光强度等级
 */
export function getGlowIntensity(mtimeMs: number, nowMs: number): GlowIntensity {
  const age = nowMs - mtimeMs
  if (age <= WEEK_MS) return 'bright'
  if (age <= MONTH_MS) return 'normal'
  return 'dim'
}
