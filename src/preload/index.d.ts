import { ElectronAPI } from '@electron-toolkit/preload'
import type { FileNode, ScanOptions, ScanProgress, ThumbnailResult } from '../shared/types'
import type { FolderStats } from '../main/folder-stats'

/** 文件完整 stat 信息（file-info 通道返回） */
export interface FileInfo {
  name: string
  path: string
  size: number
  mtimeMs: number
  ctimeMs: number
  birthtimeMs: number
  isDirectory: boolean
  isHidden: boolean
}

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI: {
      getThumbnail(filePath: string): Promise<ThumbnailResult | null>
      scanDirectory(dirPath: string, options?: ScanOptions): Promise<FileNode>
      onScanProgress(callback: (progress: ScanProgress) => void): () => void
      onScanPartial(callback: (root: FileNode) => void): () => void
      getConfig<T>(key: string): Promise<T>
      setConfig<T>(key: string, value: T): Promise<void>
      openFile(filePath: string): Promise<string>
      showItemInFolder(itemPath: string): Promise<void>
      saveScreenshot(dataUrl: string): Promise<boolean>
      getFolderStats(dirPath: string): Promise<FolderStats>
      getFileInfo(filePath: string): Promise<FileInfo | null>
      readFilePreview(filePath: string): Promise<{ text: string } | null>
      onSetRootPath(callback: (path: string) => void): () => void
    }
  }
}
