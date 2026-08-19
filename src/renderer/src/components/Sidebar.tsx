/**
 * 左侧边栏：展示当前目录统计、选中条目信息（文档 §6.3 选中反馈）。
 * - 未选中：当前目录统计
 * - 单选文件夹：内容格式统计（按数量降序，经 folder-stats IPC 递归统计）
 * - 单选文件：完整信息（大小/类型/修改/创建/变更时间/完整路径）+ 文本类文件内容预览
 * - 多选：数量与合计大小
 */

import { useEffect, useState } from 'react'
import type { FileNode } from '../../../shared/types'
import type { FolderStats } from '../../../main/folder-stats'
import { getFileKindLabel } from '../utils/labels'
import { formatSize, formatTime } from '../utils/scene'
import { canPreview } from '../../../shared/preview'

export interface SidebarProps {
  /** 当前目录（用于展示目录统计） */
  currentDir: FileNode | null
  selected: FileNode[]
}

/** 文件类型的中文名称 */
function kindOf(node: FileNode): string {
  return node.isDirectory ? '文件夹' : getFileKindLabel(node.name)
}

/** 单选目录：异步加载格式统计 */
function useFolderStats(path: string | undefined): FolderStats | null {
  const [stats, setStats] = useState<FolderStats | null>(null)

  useEffect(() => {
    if (!path) {
      setStats(null)
      return
    }
    let cancelled = false
    window.electronAPI
      .getFolderStats(path)
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return stats
}

export function Sidebar({ currentDir, selected }: SidebarProps): React.JSX.Element {
  const selectedNode = selected[0]
  // 仅在单选文件夹时请求格式统计（hook 必须无条件调用，条件在参数上表达）
  const dirStats = useFolderStats(selectedNode?.isDirectory ? selectedNode.path : undefined)

  // 多选：统计面板
  if (selected.length > 1) {
    const totalSize = selected.reduce((sum, item) => sum + item.size, 0)
    const fileCount = selected.filter((n) => !n.isDirectory).length
    const dirCount = selected.length - fileCount
    return (
      <aside className="sidebar">
        <h3 className="sidebar-title">已选中 {selected.length} 项</h3>
        <div className="sidebar-row">
          <span>文件</span>
          <span>{fileCount}</span>
        </div>
        <div className="sidebar-row">
          <span>文件夹</span>
          <span>{dirCount}</span>
        </div>
        <div className="sidebar-row">
          <span>合计大小</span>
          <span>{formatSize(totalSize)}</span>
        </div>
      </aside>
    )
  }

  // 单选文件夹：内容格式统计
  if (selectedNode?.isDirectory) {
    return (
      <aside className="sidebar">
        <h3 className="sidebar-title" title={selectedNode.path}>
          {selectedNode.name}
        </h3>
        <div className="sidebar-row">
          <span>类型</span>
          <span>文件夹</span>
        </div>
        {dirStats ? (
          <>
            <div className="sidebar-row">
              <span>文件总数</span>
              <span>{dirStats.totalFiles}</span>
            </div>
            <div className="sidebar-row">
              <span>内容总大小</span>
              <span>{formatSize(dirStats.totalSize)}</span>
            </div>
            <div className="sidebar-section">格式统计</div>
            {dirStats.byExtension.slice(0, 12).map((item) => (
              <div className="sidebar-row" key={item.ext}>
                <span>{item.ext}</span>
                <span>
                  {item.count} 个 · {formatSize(item.size)}
                </span>
              </div>
            ))}
          </>
        ) : (
          <p className="sidebar-hint">正在统计格式分布…</p>
        )}
      </aside>
    )
  }

  // 单选文件：完整信息
  if (selectedNode) {
    return <FileInfoSidebar node={selectedNode} />
  }

  // 未选中：目录统计
  const children = currentDir?.children ?? []
  const fileCount = children.filter((n) => !n.isDirectory).length
  const dirCount = children.length - fileCount
  return (
    <aside className="sidebar">
      <h3 className="sidebar-title">GalacticFS</h3>
      <p className="sidebar-hint">单击选中星球，框选可多选，双击进入目录或打开文件</p>
      {currentDir && (
        <>
          <div className="sidebar-row">
            <span>文件</span>
            <span>{fileCount}</span>
          </div>
          <div className="sidebar-row">
            <span>文件夹</span>
            <span>{dirCount}</span>
          </div>
        </>
      )}
    </aside>
  )
}

/** 文件详情面板：基础信息 + stat 补充字段（创建/变更时间、隐藏标志）+ 文本内容预览 */
function FileInfoSidebar({ node }: { node: FileNode }): React.JSX.Element {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof window.electronAPI.getFileInfo>>>(null)
  // 内容预览：仅白名单文本文件；null = 未请求/不可预览，'' 则区分"加载失败"
  const [preview, setPreview] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.electronAPI
      .getFileInfo(node.path)
      .then((result) => {
        if (!cancelled) setInfo(result)
      })
      .catch(() => {
        if (!cancelled) setInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [node.path])

  // 切换选中文件时重置预览状态，再按白名单请求内容
  useEffect(() => {
    setPreview(null)
    setPreviewFailed(false)
    if (node.isDirectory || !canPreview(node.path)) return
    let cancelled = false
    window.electronAPI
      .readFilePreview(node.path)
      .then((result) => {
        if (cancelled) return
        if (result) setPreview(result.text)
        else setPreviewFailed(true)
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [node.path, node.isDirectory])

  return (
    <aside className="sidebar">
      <h3 className="sidebar-title" title={node.path}>
        {node.name}
      </h3>
      <div className="sidebar-row">
        <span>类型</span>
        <span>{kindOf(node)}</span>
      </div>
      <div className="sidebar-row">
        <span>大小</span>
        <span>{formatSize(node.size)}</span>
      </div>
      <div className="sidebar-row">
        <span>修改时间</span>
        <span>{formatTime(node.mtimeMs)}</span>
      </div>
      {info && (
        <>
          <div className="sidebar-row">
            <span>创建时间</span>
            <span>{formatTime(info.birthtimeMs)}</span>
          </div>
          <div className="sidebar-row">
            <span>变更时间</span>
            <span>{formatTime(info.ctimeMs)}</span>
          </div>
          <div className="sidebar-row">
            <span>隐藏</span>
            <span>{info.isHidden ? '是' : '否'}</span>
          </div>
          <div className="sidebar-section">完整路径</div>
          <p className="sidebar-path">{node.path}</p>
        </>
      )}
      {preview !== null && (
        <>
          <div className="sidebar-section">内容预览</div>
          <pre className="sidebar-preview">{preview}</pre>
        </>
      )}
      {previewFailed && <p className="sidebar-hint">无法预览（二进制、过大或不可读）</p>}
    </aside>
  )
}
