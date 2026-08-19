/**
 * 应用内右键菜单：在星球上右键弹出的上下文菜单（文档 §2.3）。
 * 菜单项：复制路径（写入剪贴板）、在文件管理器中定位（shell.showItemInFolder）。
 * 点击菜单项或空白处关闭；Esc 关闭。
 */

import { useEffect, useRef } from 'react'
import type { FileNode } from '../../../shared/types'

export interface ContextMenuState {
  /** 触发菜单的条目 */
  node: FileNode
  /** 鼠标屏幕坐标（固定菜单位置） */
  x: number
  y: number
}

export function ContextMenu({
  menu,
  onClose
}: {
  menu: ContextMenuState
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  // 点击空白处 / Esc 关闭菜单
  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // 菜单超出视口右/下边缘时向左/上收拢
  const style = {
    left: Math.min(menu.x, window.innerWidth - 200),
    top: Math.min(menu.y, window.innerHeight - 110)
  }

  const copyPath = async (): Promise<void> => {
    await navigator.clipboard.writeText(menu.node.path)
    onClose()
  }

  return (
    <div ref={ref} className="context-menu" style={style}>
      <button type="button" className="context-menu-item" onClick={() => void copyPath()}>
        复制路径
      </button>
      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          void window.electronAPI.showItemInFolder(menu.node.path)
          onClose()
        }}
      >
        在文件管理器中定位
      </button>
    </div>
  )
}
