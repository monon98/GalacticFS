/**
 * 扫描进度条：目录扫描期间在顶部显示进度（文档 §2.2 进度反馈）。
 * scanned 为已扫描条目数，currentPath 为当前正在扫描的路径。
 */

import type { ScanProgress } from '../../../shared/types'

export function ProgressOverlay({
  progress
}: {
  progress: ScanProgress | null
}): React.JSX.Element | null {
  if (!progress) return null
  // 大小统计阶段单独提示：树结构已就绪但星体半径仍在计算，避免用户误以为扫描卡死
  const phaseLabel = progress.phase === 'size' ? '正在统计文件夹大小…' : '正在扫描…'

  return (
    <div className="progress-overlay">
      <div className="progress-label">
        {phaseLabel} 已处理 {progress.scanned} 项
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ animation: 'none' }} />
      </div>
      <div className="progress-current" title={progress.currentPath}>
        {progress.currentPath}
      </div>
    </div>
  )
}
