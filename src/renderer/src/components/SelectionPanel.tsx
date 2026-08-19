/**
 * 右侧选中面板：多选时列出所有选中条目（可逐个打开），底部显示操作按钮（文档 §6.3）。
 * 只读浏览器：仅提供"打开"操作，无删除/重命名（产品约束 §2.4）。
 */

import type { FileNode } from '../../../shared/types'
import { formatSize } from '../utils/scene'

export interface SelectionPanelProps {
  selected: FileNode[]
  onOpen: (node: FileNode) => void
  /** 双击事件也触发打开，防止与面板按钮重复 */
  onClear: () => void
}

export function SelectionPanel({
  selected,
  onOpen,
  onClear
}: SelectionPanelProps): React.JSX.Element | null {
  if (selected.length <= 1) return null

  return (
    <div className="selection-panel">
      <div className="selection-header">
        <span>已选中 {selected.length} 项</span>
        <button type="button" className="selection-clear" onClick={onClear}>
          清空
        </button>
      </div>
      <ul className="selection-list">
        {selected.map((node) => (
          <li key={node.path} className="selection-item" title={node.path}>
            <span className={`selection-icon ${node.isDirectory ? 'dir' : 'file'}`} />
            <span className="selection-name">{node.name}</span>
            <span className="selection-size">
              {node.isDirectory ? '目录' : formatSize(node.size)}
            </span>
            <button type="button" className="selection-open" onClick={() => onOpen(node)}>
              打开
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
