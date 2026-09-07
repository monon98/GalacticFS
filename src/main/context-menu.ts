/**
 * Windows 右键菜单集成：注册 "在 GalacticFS 中浏览" 到目录/磁盘与文件的右键菜单（文档 §4.2）。
 * 通过注册表 HKCU\Software\Classes\{Directory,*}\shell\GalacticFS 实现，仅打包后注册，
 * 免管理员权限；NSIS 安装脚本（installer/installer.nsh）另行注册 HKCR 全局键，双重保障。
 * 注册命令：<exe> --open-path "%1"，主进程解析后经 get-open-path IPC 供渲染进程拉取。
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 注册表根键（HKCU 无需管理员权限）：* = 文件，Directory = 文件夹/磁盘 */
const SHELL_KEYS = [
  'HKCU\\Software\\Classes\\*\\shell\\GalacticFS',
  'HKCU\\Software\\Classes\\Directory\\shell\\GalacticFS'
] as const

/**
 * 注册右键菜单项（幂等：重复执行会覆盖现有注册）。
 * @param exePath 打包后的主程序绝对路径
 */
export async function registerContextMenus(exePath: string): Promise<void> {
  const quoted = `"${exePath}" --open-path "%1"`
  for (const key of SHELL_KEYS) {
    await execFileAsync('reg', ['add', key, '/ve', '/d', '在 GalacticFS 中浏览', '/f'])
    await execFileAsync('reg', ['add', `${key}\\command`, '/ve', '/d', quoted, '/f'])
  }
}

/**
 * 卸载右键菜单项（应用卸载/首次启动失败回滚时调用）。
 */
export async function unregisterContextMenus(): Promise<void> {
  for (const key of SHELL_KEYS) {
    await execFileAsync('reg', ['delete', key, '/f']).catch(() => {
      // 未注册过时删除失败可忽略
    })
  }
}
