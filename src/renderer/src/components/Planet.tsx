/**
 * 星球组件：一个文件/目录 = 一颗行星（文档 §6.1 视觉映射）。
 * 大小→半径（目录按内容总大小）、类型→颜色、修改时间→发光强度、缩略图贴图。
 * 动态：行星自转（公转由外层轨道组统一控制；自转速度按路径哈希随机，同星稳定）；
 * 恒星/星环设计被用户偏好覆盖：恒星与星系不再绘制圆环。
 * 交互：单击选中（展示信息）、双击打开、悬停发光。
 * 区分：目录 = 青色 + 金色标签；文件 = 类型色 + 白色标签。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { FileNode } from '../../../shared/types'
import {
  FILE_COLOR,
  getDirColor,
  getGlowIntensity,
  getPlanetRadius
} from '../../../shared/visual-mapping'
import { canThumbnail, speedFactor } from '../utils/scene'
import { useThumbnail } from '../hooks/useThumbnail'

export interface PlanetProps {
  node: FileNode
  position: [number, number, number]
  /** 目录层级（1 = 一级子目录）；文件忽略 */
  level?: number
  /** 覆盖半径（星系核传入 computeGalacticCoreRadius 结果，保证中心最大） */
  radius?: number
  selected: boolean
  /** 是否渲染名称标签（条目较多时为保性能关闭） */
  showLabel: boolean
  /** 搜索命中：脉冲闪烁高亮（文档 §6.3 搜索匹配反馈） */
  searchMatch?: boolean
  /** 单击选中（信息面板展示） */
  onSelect: (node: FileNode) => void
  /** 双击打开（文件 → 系统应用，目录 → 进入子目录） */
  onOpen: (node: FileNode) => void
  /** 右键：弹出应用内菜单（复制路径/定位） */
  onContextMenu?: (node: FileNode, screenX: number, screenY: number) => void
}

export function Planet({
  node,
  position,
  level = 1,
  radius: radiusOverride,
  selected,
  showLabel,
  searchMatch = false,
  onSelect,
  onOpen,
  onContextMenu
}: PlanetProps): React.JSX.Element {
  const spinGroup = useRef<THREE.Group>(null)
  // 搜索脉冲容器：搜索命中时外层放大振荡（与自转、轨道旋转互不干扰）
  const pulseGroup = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  // 大小→半径：目录按内容总大小映射（对数缩放），文件按自身大小；星系核可用外部半径覆盖
  const radius =
    radiusOverride ??
    (node.isDirectory ? Math.max(getPlanetRadius(node.size), 0.8) : getPlanetRadius(node.size))
  // 目录按层级配色（颜色优先级），文件统一中性色（靠预览图区分，文档 §6.1 被用户偏好覆盖）
  const color = node.isDirectory ? getDirColor(level) : FILE_COLOR
  // 发光强度：1 周内高亮、1 月内正常、更久暗淡（文档 §6.1）；"当前时间"挂载时取一次
  const [now] = useState(() => Date.now())
  const glowIntensity = getGlowIntensity(node.mtimeMs, now)

  // 行星自转（慢速目录/快速文件 × 路径哈希随机因子：同星稳定、星间各异）
  useFrame((_, delta) => {
    if (spinGroup.current) {
      const base = node.isDirectory ? 0.2 : 0.4
      spinGroup.current.rotation.y += delta * base * speedFactor(node.path)
    }
  })

  // 搜索命中：脉冲放大 + 发光强度振荡（文档 §6.3 搜索匹配闪烁）
  useFrame(({ clock }) => {
    if (pulseGroup.current && searchMatch) {
      const t = clock.getElapsedTime()
      pulseGroup.current.scale.setScalar(1 + Math.abs(Math.sin(t * 6)) * 0.35)
    }
  })

  // 缩略图：仅图片/视频请求，其余保持类型色
  const thumbnailUrl = useThumbnail(canThumbnail(node) ? node.path : undefined)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!thumbnailUrl) return
    // 手动加载避免 useTexture 对 undefined 报错；卸载时释放 GPU 纹理
    const loader = new THREE.TextureLoader()
    const textureInstance = loader.load(thumbnailUrl, (loaded) => setTexture(loaded))
    return () => {
      textureInstance.dispose()
    }
  }, [thumbnailUrl])
  const emissive = useMemo(() => new THREE.Color(color), [color])

  const handleClick = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
    onSelect(node)
  }

  const handleDoubleClick = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
    onOpen(node)
  }

  const handleContextMenu = (event: {
    stopPropagation: () => void
    clientX: number
    clientY: number
  }): void => {
    event.stopPropagation()
    onContextMenu?.(node, event.clientX, event.clientY)
  }

  const scale = selected || hovered ? radius * 1.15 : radius

  return (
    <group position={position}>
      {/* 搜索脉冲容器：命中时放大振荡 */}
      <group ref={pulseGroup} scale={searchMatch ? 1.2 : 1}>
        <group scale={scale}>
          <group ref={spinGroup}>
            <mesh
              castShadow
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHovered(true)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHovered(false)
                document.body.style.cursor = 'auto'
              }}
            >
              <sphereGeometry args={[1, 24, 24]} />
              {texture ? (
                <meshStandardMaterial
                  map={texture}
                  emissive={emissive}
                  emissiveIntensity={hovered ? 0.8 : 0.35}
                />
              ) : (
                <meshStandardMaterial
                  color={color}
                  emissive={emissive}
                  emissiveIntensity={
                    hovered
                      ? 1.0
                      : glowIntensity === 'bright'
                        ? 0.9
                        : glowIntensity === 'normal'
                          ? 0.45
                          : 0.15
                  }
                />
              )}
            </mesh>
            {/* 搜索命中高亮环（金色脉冲环，区别于青色选中环） */}
            {searchMatch && (
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <torusGeometry args={[1.9, 0.04, 8, 48]} />
                <meshBasicMaterial color="#F5C842" transparent opacity={0.8} />
              </mesh>
            )}
          </group>
          {/* 悬停辅助：底部小光点 */}
          {hovered && (
            <mesh position={[0, -1.3, 0]}>
              <circleGeometry args={[0.12, 16]} />
              <meshBasicMaterial color="#FF6B35" />
            </mesh>
          )}
          {/* 名称标签：Html 实现（支持中文）；目录金色徽章样式，文件白色 */}
          {showLabel && (
            <Html
              position={[0, 2.1, 0]}
              center
              distanceFactor={6}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <span
                className={node.isDirectory ? 'planet-label dir' : 'planet-label'}
                style={{ opacity: hovered ? 1 : 0.8 }}
              >
                {node.name}
              </span>
            </Html>
          )}
        </group>
      </group>
    </group>
  )
}
