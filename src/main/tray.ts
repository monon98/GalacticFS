/**
 * 托盘模块：创建系统托盘图标与菜单（文档 §2.1 系统托盘）。
 * 菜单项：打开主窗口 / 检查更新 / 退出（中文文案）。
 * 平台兼容：Linux 桌面环境无托盘支持（StatusNotifier 缺失）或图标加载失败时
 * 静默降级返回 null，不阻塞应用启动。
 */

import { app, dialog, Menu, Tray, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

/**
 * 托盘图标路径：dev 为项目 resources，打包后为 asar 内 resources（Electron 透明支持 asar 路径）。
 * 注意：打包后图标在 app.asar/resources 内，process.resourcesPath 根目录下不存在 icon.png，
 * 误用会导致图标为空、托盘静默降级不显示。
 */
function trayIconPath(): string {
  return join(__dirname, '../../resources/icon.png')
}

/**
 * 创建托盘图标与右键菜单。
 * @param getWindow 获取主窗口的回调（窗口可能尚未创建或已销毁）
 * @param onCheckUpdate 菜单"检查更新"的回调（由更新器模块注入）
 * @returns 托盘实例（需保持引用防止被 GC 回收）；平台不支持时返回 null
 */
export function createTray(
  getWindow: () => BrowserWindow | null,
  onCheckUpdate: () => void
): Tray | null {
  try {
    const icon = nativeImage.createFromPath(trayIconPath())
    if (icon.isEmpty()) throw new Error('托盘图标为空')
    const tray = new Tray(icon)

    const menu = Menu.buildFromTemplate([
      {
        label: '打开主窗口',
        click: () => {
          const win = getWindow()
          if (win) {
            if (win.isMinimized()) win.restore()
            win.show()
            win.focus()
          }
        }
      },
      { label: '检查更新', click: onCheckUpdate },
      {
        label: '关于',
        click: () => {
          // 版本信息弹窗（文档 §4.1 托盘"关于"）
          void dialog.showMessageBox({
            type: 'info',
            title: '关于 GalacticFS',
            message: `GalacticFS v${app.getVersion()}`,
            detail: '3D 空间文件浏览器\n探索你的文件——不是列表，而是一个宇宙。',
            buttons: ['确定']
          })
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit()
        }
      }
    ])

    tray.setToolTip('GalacticFS')
    tray.setContextMenu(menu)

    // 左键单击也打开主窗口（Windows 惯例）
    tray.on('click', () => {
      const win = getWindow()
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })

    return tray
  } catch (error) {
    // Linux 桌面环境无托盘支持时静默降级（仅记录，不阻塞启动）
    console.warn('[tray] 托盘创建失败，已降级：', error)
    return null
  }
}
