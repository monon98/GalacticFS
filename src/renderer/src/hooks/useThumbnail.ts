/**
 * 缩略图 hook：通过 IPC 获取文件缩略图并转为 object URL（文档 §4.6.5）。
 * 组件卸载或路径变化时回收 URL，防止内存泄漏。
 */

import { useEffect, useState } from 'react'

export function useThumbnail(filePath: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!filePath) return
    let revoked: string | null = null
    let cancelled = false

    window.electronAPI.getThumbnail(filePath).then((result) => {
      if (!result || cancelled) return
      // 显式拷贝为 ArrayBuffer 视图，满足 BlobPart 的类型要求
      const objectUrl = URL.createObjectURL(
        new Blob([new Uint8Array(result.data)], { type: 'image/png' })
      )
      revoked = objectUrl
      setUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
      setUrl(null)
    }
  }, [filePath])

  return url
}
