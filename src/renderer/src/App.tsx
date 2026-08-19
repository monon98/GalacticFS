/**
 * 应用根组件：组合 3D 场景与 UI 层，管理导航/选中/配置状态。
 * 启动时读取 defaultRootPath 配置；接收 --open-path（右键菜单）重定向根路径；
 * 设置保存后触发重新扫描（scanNonce）与根路径切换。
 */

import { useCallback, useEffect, useState } from 'react'
import type { FileNode } from '../../shared/types'
import { useFileTree } from './hooks/useFileTree'
import { GalacticScene } from './components/GalacticScene'
import { SearchBar } from './components/SearchBar'
import { ContextMenu } from './components/ContextMenu'
import type { ContextMenuState } from './components/ContextMenu'
import { Breadcrumb } from './components/Breadcrumb'
import { Sidebar } from './components/Sidebar'
import { SelectionPanel } from './components/SelectionPanel'
import { ProgressOverlay } from './components/ProgressOverlay'
import { SettingsPanel } from './components/SettingsPanel'

/** 目录扫描中或配置加载中的加载提示 */
function LoadingView({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="loading-view">
      <div className="loading-spinner" />
      <span>{text}</span>
    </div>
  )
}

export default function App(): React.JSX.Element {
  // 初始根路径：优先读取用户配置，未配置时回退到主进程默认（用户主目录）
  const [startPath, setStartPath] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI
      .getConfig<string>('defaultRootPath')
      .then((path) => setStartPath(path || ''))
      .catch((err: unknown) => {
        setStartError(err instanceof Error ? err.message : String(err))
        setStartPath('')
      })
  }, [])

  if (startPath === null) {
    return <LoadingView text={startError ? `配置读取失败：${startError}` : '正在加载配置…'} />
  }

  return <MainView key={startPath} startPath={startPath} onRootPathChange={setStartPath} />
}

/** 主视图：startPath 变化时通过 key 强制重挂载（重新以新根路径扫描） */
function MainView({
  startPath,
  onRootPathChange
}: {
  startPath: string
  onRootPathChange: (path: string) => void
}): React.JSX.Element {
  // scanNonce：设置保存后 +1 触发当前目录重新扫描（生效隐藏文件/忽略列表变更）
  const [scanNonce, setScanNonce] = useState(0)
  const { currentPath, tree, partial, progress, error, navigate, goUp } = useFileTree(
    startPath,
    scanNonce
  )
  const [selected, setSelected] = useState<FileNode[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 搜索关键词：匹配的星球脉冲闪烁（文档 §2.2 搜索高亮）
  const [searchQuery, setSearchQuery] = useState('')
  // 应用内右键菜单状态（null = 未打开）
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  // 导出截图请求计数：点击"截图"按钮 +1，GalacticScene 响应后导出
  const [exportRequest, setExportRequest] = useState(0)
  // 截图导出中状态（主进程弹窗期间防重复点击）
  const [exporting, setExporting] = useState(false)

  // 右键菜单 "--open-path"：外部指定新根路径时切换
  useEffect(() => {
    return window.electronAPI.onSetRootPath((path) => {
      navigate(path)
      setSelected([])
    })
  }, [navigate])

  // 目录切换时清空选中（旧目录的对象已不在场景中）
  useEffect(() => {
    setSelected([])
  }, [currentPath])

  const handleOpen = useCallback(
    (node: FileNode) => {
      if (node.isDirectory) {
        navigate(node.path)
      } else {
        // 只读浏览器：仅用系统默认应用打开（产品约束 §2.4）
        window.electronAPI.openFile(node.path)
      }
    },
    [navigate]
  )

  const handleGoUp = useCallback(() => {
    if (!goUp()) setSelected([])
  }, [goUp])

  // 星球右键：记录坐标弹出应用内菜单（复制路径/定位）
  const handleContextMenu = useCallback((node: FileNode, x: number, y: number) => {
    setContextMenu({ node, x, y })
  }, [])

  // 截图导出：请求场景导出 → 主进程弹窗保存
  const handleExport = useCallback((dataUrl: string) => {
    setExporting(true)
    window.electronAPI
      .saveScreenshot(dataUrl)
      .finally(() => setExporting(false))
      .catch(() => setExporting(false))
  }, [])

  const handleSettingsSaved = useCallback(
    (settings: { defaultRootPath: string }) => {
      // 隐藏文件/忽略列表变更：重扫当前目录生效
      setScanNonce((n) => n + 1)
      // 根路径变更：App 层 key 变化 → 整个主视图以新根路径重挂载
      if (settings.defaultRootPath && settings.defaultRootPath !== startPath) {
        onRootPathChange(settings.defaultRootPath)
      }
    },
    [startPath, onRootPathChange]
  )

  const selectedPaths = new Set(selected.map((n) => n.path))

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="app-title">GalacticFS</h1>
        {/* 一键返回起始目录（启动时的默认根目录） */}
        <button
          type="button"
          className="home-button"
          title={`返回起始目录：${startPath}`}
          onClick={() => {
            navigate(startPath)
            setSelected([])
          }}
        >
          ⌂
        </button>
        <Breadcrumb currentPath={currentPath} onNavigate={navigate} onGoUp={handleGoUp} />
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <button
          type="button"
          className="settings-button"
          disabled={exporting}
          onClick={() => setExportRequest((n) => n + 1)}
          title="导出当前场景为 PNG 图片"
        >
          截图
        </button>
        <button type="button" className="settings-button" onClick={() => setSettingsOpen(true)}>
          设置
        </button>
      </header>

      {/* 处理完扫描项后自动隐藏：tree 到达即不再显示进度条（双保险，防时序残留） */}
      <ProgressOverlay progress={tree ? null : progress} />

      <Sidebar currentDir={tree} selected={selected} />
      <SelectionPanel selected={selected} onOpen={handleOpen} onClear={() => setSelected([])} />

      <main className="scene-host">
        {/* 目录切换过渡：key 变化触发淡入动画（文档 §6.3 场景渐变过渡） */}
        <div key={currentPath} className="scene-fade">
          {/* 分段渲染：完整树未到时用首层部分树先行展示 */}
          {error ? (
            <div className="error-view">
              <p>无法读取该目录：</p>
              <pre>{error}</pre>
              <button type="button" onClick={() => navigate(currentPath)}>
                重试
              </button>
            </div>
          ) : !tree && !partial ? (
            <LoadingView text="正在扫描目录…" />
          ) : (
            <GalacticScene
              currentDir={tree ?? partial!}
              selectedPaths={selectedPaths}
              searchQuery={searchQuery}
              onSelect={setSelected}
              onOpen={handleOpen}
              onGoUp={handleGoUp}
              onContextMenu={handleContextMenu}
              exportRequest={exportRequest}
              onExported={handleExport}
            />
          )}
        </div>
      </main>

      {/* 应用内右键菜单 */}
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />
    </div>
  )
}
