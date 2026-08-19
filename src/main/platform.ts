/**
 * 平台适配模块：系统集成（右键菜单/托盘等）按平台激活，非 Windows 平台静默跳过。
 * - Windows：注册表右键菜单（文件 + 目录）→ context-menu.ts
 * - macOS：无注册表概念，Dock 常驻替代右键菜单
 * - Linux：文件管理器右键集成（.desktop Actions）因桌面环境差异大暂不实现，
 *   托盘在支持 StatusNotifier 的桌面环境可用（创建失败由 tray.ts 静默降级）
 * 新增平台集成逻辑统一在此扩展，入口 index.ts 不再散落平台判断。
 */

import { registerContextMenus, unregisterContextMenus } from './context-menu'

export const isWindows = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

/**
 * 安装平台系统集成（打包后启动时调用；失败仅告警，不影响应用启动）。
 * @param exePath 打包后的主程序绝对路径（Windows 右键菜单命令使用）
 */
export async function installSystemIntegration(exePath: string): Promise<void> {
  if (isWindows) {
    await registerContextMenus(exePath)
    return
  }
  console.log(`[platform] ${process.platform} 无注册表右键菜单，跳过系统集成`)
}

/**
 * 卸载平台系统集成（应用卸载清理时调用；未注册过时静默忽略）。
 */
export async function uninstallSystemIntegration(): Promise<void> {
  if (isWindows) {
    await unregisterContextMenus()
  }
}
