/**
 * 文件类型中文标签：扩展名 → 中文类型名（与 shared/visual-mapping 的类别划分一致）。
 * 用于侧边栏与选中面板展示。
 */

/** 扩展名 → 中文标签的映射（图片/视频/文档/代码/压缩包/其他） */
const KIND_LABELS: Record<string, string> = {
  图片: '图片',
  视频: '视频',
  文档: '文档',
  代码: '代码',
  压缩包: '压缩包',
  其他: '其他文件'
}

/**
 * 根据文件名推断类型中文标签。
 * @param name 文件名（含扩展名）
 * @returns 中文类型名
 */
export function getFileKindLabel(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return KIND_LABELS['其他']
  const ext = name.slice(dotIndex + 1).toLowerCase()

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'svg'].includes(ext))
    return KIND_LABELS['图片']
  if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v'].includes(ext))
    return KIND_LABELS['视频']
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx', 'epub'].includes(ext))
    return KIND_LABELS['文档']
  if (
    [
      'js',
      'ts',
      'tsx',
      'jsx',
      'py',
      'java',
      'c',
      'cpp',
      'h',
      'go',
      'rs',
      'html',
      'css',
      'json',
      'yaml',
      'yml',
      'xml',
      'sh',
      'bat',
      'ps1',
      'sql'
    ].includes(ext)
  )
    return KIND_LABELS['代码']
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext))
    return KIND_LABELS['压缩包']
  return KIND_LABELS['其他']
}
