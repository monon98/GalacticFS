/**
 * 文件树状态管理：目录导航 + 扫描进度 + 分段渲染。
 * 当前路径变化时触发扫描（IPC scan-directory），进度事件流式更新；
 * 主进程首层就绪后推送 scan-partial（壳目录 + 文件），立即渲染行星，
 * 完整树到达后替换（tree ?? partial 渲染，见 App）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileNode, ScanProgress } from '../../../shared/types'

export interface UseFileTreeResult {
  /** 当前浏览的目录路径 */
  currentPath: string
  /** 当前目录的完整文件树（null 表示尚未完成） */
  tree: FileNode | null
  /** 分段渲染的首层部分树（完整树未到时先行展示；与 tree 互斥使用） */
  partial: FileNode | null
  /** 扫描进度（null 表示未在扫描） */
  progress: ScanProgress | null
  /** 扫描失败的错误信息 */
  error: string | null
  /** 切换目录（进入子目录/面包屑回退） */
  navigate: (path: string) => void
  /** 返回上级目录；已在根目录时返回 false */
  goUp: () => boolean
}

export function useFileTree(initialPath: string, scanNonce = 0): UseFileTreeResult {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [tree, setTree] = useState<FileNode | null>(null)
  const [partial, setPartial] = useState<FileNode | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 用 ref 记录请求序号，防止旧目录的慢扫描结果覆盖新目录
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setTree(null)
    setPartial(null)
    setError(null)
    setProgress({ scanned: 0, currentPath })

    const unsubscribeProgress = window.electronAPI.onScanProgress((p) => {
      // 统计进度持续展示（含 partial 后的后台统计），直到完整树到达才消失
      if (requestId.current === id) setProgress(p)
    })
    // 分段渲染：首层结果按目标路径过滤（避免旧扫描的迟到 partial 污染新目录）；
    // 场景先行渲染，进度条继续显示后台统计，完整树到达后收起（tree 完成即 setProgress(null)）
    const unsubscribePartial = window.electronAPI.onScanPartial((root) => {
      if (root.path !== currentPath) return
      setPartial(root)
    })

    // 扫描选项（隐藏文件/忽略列表/深度）由主进程从配置读取
    window.electronAPI
      .scanDirectory(currentPath)
      .then((result) => {
        if (requestId.current !== id) return
        setTree(result)
        setPartial(null)
        setProgress(null)
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return
        setError(err instanceof Error ? err.message : String(err))
        setPartial(null)
        setProgress(null)
      })

    return () => {
      unsubscribeProgress()
      unsubscribePartial()
      // 使当前请求 id 失效：刻意读取 ref 最新值（后续 effect 可能已递增），阻止迟到结果写入新目录状态
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++
    }
  }, [currentPath, scanNonce])

  const navigate = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

  const goUp = useCallback((): boolean => {
    // 通过 file-scanner 树结构推导父路径：仅去掉末尾一层（Windows 盘符根目录不可再上）
    const parts = currentPath.split(/[\\/]/).filter(Boolean)
    if (parts.length <= 1) return false
    const parent = parts.slice(0, -1).join('\\')
    setCurrentPath(parent || '\\')
    return true
  }, [currentPath])

  return { currentPath, tree, partial, progress, error, navigate, goUp }
}
