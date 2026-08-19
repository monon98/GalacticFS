/**
 * 自动更新模块：基于 electron-updater 的 GitHub Releases 源（文档 §10.2 更新器）。
 * 更新源配置在 electron-builder.yml / dev-app-update.yml 的 publish（provider: github）。
 * 仅打包后启用检查；开发模式下跳过，避免误连生产源。
 */

import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/** 更新检查是否已触发过（防止托盘菜单重复触发） */
let checkTriggered = false

/**
 * 检查更新：静默下载，下载完成后提示安装。
 * 下载由 GitHub Releases 提供（公开仓库无需令牌），上传需要 GH_TOKEN（见 electron-builder 文档）。
 */
export function checkForUpdates(): void {
  if (!app.isPackaged) {
    console.log('[updater] 开发模式跳过自动更新检查')
    return
  }
  if (checkTriggered) return
  checkTriggered = true

  autoUpdater.autoDownload = true
  autoUpdater.on('update-downloaded', () => {
    // 下载完成后询问是否立即重启安装（避免打断用户操作）
    dialog
      .showMessageBox({
        type: 'info',
        title: 'GalacticFS 更新',
        message: '新版本已下载完成',
        detail: '是否立即重启以完成安装？',
        buttons: ['立即重启', '稍后']
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.error('[updater] 检查更新失败：', err)
  })
}
