/**
 * 设置面板（模态对话框）：默认扫描根目录、显示隐藏文件、忽略的文件夹列表。
 * 保存时经 setConfig IPC 写入主进程配置；忽略列表以逗号分隔输入。
 * 保存成功后回调 onSaved，由 App 触发重新扫描。
 */

import { useEffect, useState } from 'react'

export interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  /** 保存成功回调（配置已持久化） */
  onSaved: (settings: { defaultRootPath: string }) => void
}

interface SettingsForm {
  defaultRootPath: string
  includeHidden: boolean
  ignoredFolders: string
}

export function SettingsPanel({
  open,
  onClose,
  onSaved
}: SettingsPanelProps): React.JSX.Element | null {
  const [form, setForm] = useState<SettingsForm>({
    defaultRootPath: '',
    includeHidden: false,
    ignoredFolders: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 应用信息（版本号等）：面板"关于"区域展示
  const [appInfo, setAppInfo] = useState<{ version: string; platform: string } | null>(null)

  // 打开时读取应用信息（版本号）
  useEffect(() => {
    if (!open) return
    window.electronAPI
      .getAppInfo()
      .then(setAppInfo)
      .catch(() => setAppInfo(null))
  }, [open])

  // 打开时从主进程读取当前配置，回填表单
  useEffect(() => {
    if (!open) return
    Promise.all([
      window.electronAPI.getConfig<string>('defaultRootPath'),
      window.electronAPI.getConfig<boolean>('includeHidden'),
      window.electronAPI.getConfig<string[]>('ignoredFolders')
    ])
      .then(([defaultRootPath, includeHidden, ignoredFolders]) => {
        setForm({
          defaultRootPath,
          includeHidden,
          ignoredFolders: ignoredFolders.join(', ')
        })
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [open])

  if (!open) return null

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const ignoredFolders = form.ignoredFolders
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
      await window.electronAPI.setConfig('defaultRootPath', form.defaultRootPath.trim())
      await window.electronAPI.setConfig('includeHidden', form.includeHidden)
      await window.electronAPI.setConfig('ignoredFolders', ignoredFolders)
      onSaved({ defaultRootPath: form.defaultRootPath.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="settings-title">设置</h2>

        <label className="settings-field">
          <span>默认扫描根目录</span>
          <input
            type="text"
            value={form.defaultRootPath}
            placeholder="如 D:\Code 或 C:\Users\你"
            onChange={(e) => setForm({ ...form, defaultRootPath: e.target.value })}
          />
        </label>

        <label className="settings-field check">
          <input
            type="checkbox"
            checked={form.includeHidden}
            onChange={(e) => setForm({ ...form, includeHidden: e.target.checked })}
          />
          <span>显示隐藏文件（点开头）</span>
        </label>

        <label className="settings-field">
          <span>忽略的文件夹（逗号分隔目录名）</span>
          <input
            type="text"
            value={form.ignoredFolders}
            placeholder="node_modules, .git, __pycache__"
            onChange={(e) => setForm({ ...form, ignoredFolders: e.target.value })}
          />
        </label>

        {error && <div className="settings-error">{error}</div>}

        {/* 关于：版本号 + 平台信息（文档 §4.1 关于信息） */}
        <div className="settings-about">
          <span>GalacticFS</span>
          <span>{appInfo ? `v${appInfo.version} · ${appInfo.platform}` : '…'}</span>
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="settings-save"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
