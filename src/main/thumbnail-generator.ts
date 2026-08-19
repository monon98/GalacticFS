/**
 * 缩略图生成器：为图片/视频文件生成缩略图（文档 §4.6.2）。
 * 支持格式用 nativeImage.createThumbnailFromPath 生成，其余格式降级为系统文件图标；
 * 该模块依赖 Electron 主进程 API（nativeImage/app），只能在主进程运行。
 */

import { nativeImage, app } from 'electron'
import { existsSync } from 'node:fs'
import { extname } from 'node:path'

/** 文档 §4.6.2 定义的可生成缩略图的格式（图片 + 视频） */
const SUPPORTED_EXTENSIONS = new Set([
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

/**
 * 判断文件是否支持生成缩略图（按扩展名，大小写不敏感）。
 * @param filePath 文件路径
 * @returns true 表示可用 nativeImage.createThumbnailFromPath 生成
 */
export function isThumbnailSupported(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export interface GeneratedThumbnail {
  /** PNG 编码的缩略图数据 */
  data: Buffer
  width: number
  height: number
  /** thumbnail = 真实缩略图，icon = 系统文件图标降级 */
  type: 'thumbnail' | 'icon'
}

/**
 * 生成缩略图：支持格式生成缩略图，失败或不受支持时降级为系统文件图标。
 * @param filePath 文件绝对路径
 * @param size 目标尺寸（像素），默认 256
 * @returns 缩略图数据；文件不存在时返回 null
 */
export async function generateThumbnail(
  filePath: string,
  size = 256
): Promise<GeneratedThumbnail | null> {
  if (!existsSync(filePath)) return null

  if (isThumbnailSupported(filePath)) {
    try {
      const img = await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size })
      return {
        data: img.toPNG(),
        width: img.getSize().width,
        height: img.getSize().height,
        type: 'thumbnail'
      }
    } catch {
      // 生成失败（如损坏文件）时降级到图标
    }
  }

  const icon = await app.getFileIcon(filePath, { size: 'large' })
  const iconSize = icon.getSize()
  return {
    data: icon.toPNG(),
    width: iconSize.width,
    height: iconSize.height,
    type: 'icon'
  }
}
