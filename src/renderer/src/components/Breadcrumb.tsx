/**
 * 面包屑导航：展示当前路径层级，点击任意层跳转（文档 §2.1 目录层级导航）。
 * Windows 路径按 \ 或 / 分段；盘符根目录（C:\）作为首段。
 */

export interface BreadcrumbProps {
  currentPath: string
  onNavigate: (path: string) => void
  onGoUp: () => void
}

/** 将路径拆分为逐级可达的 [显示名, 完整路径] 对 */
function splitPath(path: string): { label: string; fullPath: string }[] {
  const driveMatch = path.match(/^([A-Za-z]:)[\\/]?/)
  const drive = driveMatch ? driveMatch[1].toUpperCase() : null
  const rest = driveMatch ? path.slice(driveMatch[0].length) : path
  const parts = rest.split(/[\\/]/).filter(Boolean)

  const segments: { label: string; fullPath: string }[] = []
  if (drive) segments.push({ label: drive, fullPath: drive + '\\' })
  let acc = drive ? drive + '\\' : ''
  for (const part of parts) {
    acc += part + '\\'
    segments.push({ label: part, fullPath: acc })
  }
  return segments
}

export function Breadcrumb({
  currentPath,
  onNavigate,
  onGoUp
}: BreadcrumbProps): React.JSX.Element {
  const segments = splitPath(currentPath)

  return (
    <nav className="breadcrumb">
      <button type="button" className="breadcrumb-back" onClick={onGoUp} title="返回上级目录">
        ←
      </button>
      {segments.map((segment, index) => (
        <span key={segment.fullPath} className="breadcrumb-segment">
          {index > 0 && <span className="breadcrumb-separator">/</span>}
          <button
            type="button"
            className={
              index === segments.length - 1 ? 'breadcrumb-item current' : 'breadcrumb-item'
            }
            onClick={() => onNavigate(segment.fullPath)}
          >
            {segment.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
