/**
 * 文件内容预览白名单：仅"可原生读取"的文本类文件提供预览（渲染层显示、主进程读取共用）。
 * 二进制文件（图片/视频/压缩包等）与超限文件一律拒绝，避免内存与解码风险。
 */

/** 可预览的扩展名（小写，无点号） */
const PREVIEW_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'yaml',
  'yml',
  'ini',
  'cfg',
  'conf',
  'log',
  'csv',
  'tsv',
  'env',
  'gitignore',
  'npmrc',
  'editorconfig',
  'prettierrc',
  'eslintrc',
  'sh',
  'bat',
  'cmd',
  'ps1',
  'py',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'go',
  'rs',
  'sql',
  'toml',
  'gradle',
  'properties',
  'tex',
  'rst',
  'diff',
  'patch'
])

/** 预览大小上限（字节）：超过则拒绝读取 */
export const PREVIEW_MAX_BYTES = 64 * 1024

/**
 * 判断文件是否可原生预览（扩展名白名单）。
 * 点文件（.env / .gitignore）取最后一段作为扩展名，天然匹配。
 * @param filePath 文件完整路径
 */
export function canPreview(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return PREVIEW_EXTENSIONS.has(ext)
}
