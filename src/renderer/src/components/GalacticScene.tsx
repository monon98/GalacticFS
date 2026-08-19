/**
 * 3D 场景容器：太阳系分层布局（Canvas + 星空背景 + 独立公转 + 框选多选）。
 * 中心恒星 = 当前目录；文件 = 近轨行星（每颗独立公转，速度随轨道半径递减）；
 * 目录 = 远轨子星系（星系整体公转，内部文件再绕星系核公转——双重公转）。
 * 交互：单击选中（Planet 自行处理）、双击打开、drei Select 框选多选。
 * 注意：useFrame 等 R3F hooks 必须放在 Canvas 内部的组件（GalaxySceneContent）中。
 */

import { useMemo, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Select, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { ReactNode } from 'react'
import type { FileNode } from '../../../shared/types'
import { getPlanetRadius } from '../../../shared/visual-mapping'
import { Planet } from './Planet'
import { Star } from './Star'
import {
  layoutChildPosition,
  spiralOrbits,
  computeGalacticCoreRadius,
  speedFactor,
  hashSeed
} from '../utils/scene'

/** 超过该条目数时关闭名称标签，保证帧率（文档 §7.1 ≥30 FPS） */
const LABEL_THRESHOLD = 150

/** 文件轨道最小起始半径（恒星较小或场景简单时的下限） */
const FILE_ORBIT_FIRST_MIN = 4.6
/**
 * 子星系轨道：起始半径。
 * 星系间距约束：星系间距离必须大于星体内距离。
 * 星系核放大后最大 8.1（≤6.0 × 1.35）→ 子文件环 childOrbit ≤ 19.5。
 * 第一圈轨道 40（> 2×19.5），相邻星系轨道差 ≥ 尺寸和 + DIR_ORBIT_GAP(20) ≥ 26.2，
 * 恒大于星体内距离上限——星系彼此远离、星系内部紧凑。
 */
const DIR_ORBIT_FIRST = 40
/** 子星系间的额外径向间距（大于星体内距离上限，保证星系间距离 > 星体内距离） */
const DIR_ORBIT_GAP = 20

/**
 * 独立公转速度：按轨道半径倒数衰减（外轨慢、内轨快，开普勒感）。
 * @param orbitRadius 轨道半径（px 世界单位）
 */
function orbitSpeed(orbitRadius: number): number {
  return 0.9 / (0.5 + orbitRadius)
}

/** 公转容器：把 children 整体绕中心（原点）Y 轴旋转，速度独立可配 */
function OrbitalGroup({
  speed,
  children
}: {
  speed: number
  children: ReactNode
}): React.JSX.Element {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed
  })
  return <group ref={ref}>{children}</group>
}

export interface GalacticSceneProps {
  /** 当前目录（中心恒星 + 子项数据） */
  currentDir: FileNode
  /** 选中的条目路径集合 */
  selectedPaths: Set<string>
  /** 搜索关键词：匹配星球脉冲闪烁 */
  searchQuery?: string
  onSelect: (nodes: FileNode[]) => void
  onOpen: (node: FileNode) => void
  onGoUp: () => void
  /** 星球右键：弹出应用内菜单（复制路径/定位） */
  onContextMenu: (node: FileNode, screenX: number, screenY: number) => void
  /** 导出截图请求计数（每次 +1 触发一次导出，文档 §2.3） */
  exportRequest?: number
  /** 导出完成回调（dataURL 交给主进程保存） */
  onExported?: (dataUrl: string) => void
}

export function GalacticScene({
  currentDir,
  selectedPaths,
  searchQuery = '',
  onSelect,
  onOpen,
  onGoUp,
  onContextMenu,
  exportRequest = 0,
  onExported
}: GalacticSceneProps): React.JSX.Element {
  // 数据拆分：直接文件（近轨）与直接子目录（远轨）
  const { files, dirs } = useMemo(() => {
    const all = currentDir.children ?? []
    return {
      files: all.filter((n) => !n.isDirectory),
      dirs: all.filter((n) => n.isDirectory)
    }
  }, [currentDir])

  // 子星系：星系核 = max(自身大小半径, 子文件最大半径 × 2.0) × 1.35（中心最大 + 子目录星体放大）；
  // 有效半径 = 星系核 + 子文件环，轨道间距额外加 DIR_ORBIT_GAP，星系间距离足够远
  const galaxies = useMemo(
    () =>
      dirs.map((dir) => {
        const subFiles = (dir.children ?? []).filter((n) => !n.isDirectory)
        const core =
          computeGalacticCoreRadius(
            Math.max(getPlanetRadius(dir.size), 0.8),
            subFiles.map((n) => getPlanetRadius(n.size))
          ) * 1.35
        return { dir, core, subFiles, childOrbit: Math.max(core * 2.4, 2.0) }
      }),
    [dirs]
  )
  // 中心恒星半径：所有直接子星体中最大者 × 1.5（星系中心必须最大），下限 1.25
  const starRadius = useMemo(() => {
    const maxChild = Math.max(
      ...files.map((n) => getPlanetRadius(n.size)),
      ...galaxies.map((g) => g.core),
      0
    )
    return Math.max(maxChild * 1.5, 1.25)
  }, [files, galaxies])

  // 独轨布局：每颗行星独享轨道（相同半径共享"小行星带"轨道）。
  // 大文件近中央（大星体内轨）；最内轨道须大于恒星半径 + 最大文件半径，避免与恒星重叠
  const filePlacements = useMemo(
    () =>
      spiralOrbits(
        files.map((n) => getPlanetRadius(n.size)),
        Math.max(FILE_ORBIT_FIRST_MIN, starRadius + 3.4)
      ),
    [files, starRadius]
  )
  const dirPlacements = useMemo(
    () =>
      spiralOrbits(
        galaxies.map((g) => g.core + g.childOrbit),
        DIR_ORBIT_FIRST,
        DIR_ORBIT_GAP
      ).map((p, i) => ({
        ...p,
        // 星系不都在同一水平面：按路径哈希稳定随机 y 偏移（±4，小于星系间距不会重叠）
        position: [p.position[0], (hashSeed(galaxies[i].dir.path) % 9) - 4, p.position[2]] as [
          number,
          number,
          number
        ]
      })),
    [galaxies]
  )
  // 搜索匹配：名称包含关键词（大小写不敏感）；关键词为空时无匹配
  const searchMatchedPaths = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    const matched = new Set<string>()
    const visit = (nodes: FileNode[]): void => {
      for (const n of nodes) {
        if (n.name.toLowerCase().includes(q)) matched.add(n.path)
        if (n.children) visit(n.children)
      }
    }
    visit(currentDir.children ?? [])
    return matched
  }, [searchQuery, currentDir])

  return (
    <Canvas
      camera={{ position: [0, 11, 16], fov: 60 }}
      dpr={[1, 1.5]}
      gl={{ preserveDrawingBuffer: true }}
    >
      <GalaxySceneContent
        files={files}
        dirs={dirs}
        filePositions={filePlacements.map((p) => p.position)}
        dirPositions={dirPlacements.map((p) => p.position)}
        galaxies={galaxies}
        starRadius={starRadius}
        searchMatchedPaths={searchMatchedPaths}
        currentDir={currentDir}
        selectedPaths={selectedPaths}
        onSelect={onSelect}
        onOpen={onOpen}
        onGoUp={onGoUp}
        onContextMenu={onContextMenu}
        exportRequest={exportRequest}
        onExported={onExported}
      />
    </Canvas>
  )
}

/** Canvas 内部内容：所有 R3F hooks 在此使用 */
function GalaxySceneContent({
  files,
  dirs,
  filePositions,
  dirPositions,
  galaxies,
  starRadius,
  searchMatchedPaths,
  currentDir,
  selectedPaths,
  onSelect,
  onOpen,
  onGoUp,
  onContextMenu,
  exportRequest,
  onExported
}: {
  files: FileNode[]
  dirs: FileNode[]
  filePositions: [number, number, number][]
  dirPositions: [number, number, number][]
  /** 子星系数据（星系核半径/子文件环/子文件），渲染与布局共用 */
  galaxies: { dir: FileNode; core: number; subFiles: FileNode[]; childOrbit: number }[]
  starRadius: number
  /** 搜索命中路径集合（null = 未在搜索） */
  searchMatchedPaths: Set<string> | null
  currentDir: FileNode
  selectedPaths: Set<string>
  onSelect: (nodes: FileNode[]) => void
  onOpen: (node: FileNode) => void
  onGoUp: () => void
  onContextMenu: (node: FileNode, screenX: number, screenY: number) => void
  exportRequest: number
  onExported?: (dataUrl: string) => void
}): React.JSX.Element {
  // 导出截图：请求计数变化时抓取当前帧输出为 PNG（preserveDrawingBuffer 保证非黑屏）
  const gl = useThree((state) => state.gl)
  const [lastExport, setLastExport] = useState(0)
  useEffect(() => {
    if (exportRequest > 0 && exportRequest !== lastExport) {
      setLastExport(exportRequest)
      const dataUrl = gl.domElement.toDataURL('image/png')
      onExported?.(dataUrl)
    }
  }, [exportRequest, lastExport, gl, onExported])
  // 标签阈值：任一轨道条目过多时统一关闭
  const showLabels = files.length + dirs.length <= LABEL_THRESHOLD

  return (
    <>
      <color attach="background" args={['#0B0C10']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.4} />
      <Stars radius={90} depth={45} count={5000} factor={4} saturation={0} fade speed={0.6} />

      {/* 框选容器：仅处理拖拽框选（单击选中由 Planet 自身处理，避免双触发） */}
      <Select
        box
        multiple
        onChange={(objects) => {
          if (objects.length > 1) {
            const selected = objects
              .map((obj) => obj.userData.node as FileNode | undefined)
              .filter((n): n is FileNode => Boolean(n))
            onSelect(selected)
          }
        }}
      >
        {/* 近轨：直接文件，每颗独立公转（速度随轨道半径递减） */}
        {files.map((node, i) => {
          const radius = Math.hypot(filePositions[i][0], filePositions[i][2])
          return (
            <OrbitalGroup key={node.path} speed={orbitSpeed(radius) * speedFactor(node.path)}>
              <Planet
                node={node}
                position={filePositions[i]}
                selected={selectedPaths.has(node.path)}
                searchMatch={searchMatchedPaths?.has(node.path) ?? false}
                showLabel={showLabels}
                onSelect={(n) => onSelect([n])}
                onOpen={onOpen}
                onContextMenu={onContextMenu}
              />
            </OrbitalGroup>
          )
        })}

        {/* 远轨：子星系（星系核 = 目录，中心最大；星系整体公转，内部文件绕核再公转） */}
        {galaxies.map(({ dir, core, subFiles, childOrbit }, i) => {
          const dirRadius = Math.hypot(dirPositions[i][0], dirPositions[i][2])
          return (
            <OrbitalGroup key={dir.path} speed={orbitSpeed(dirRadius) * speedFactor(dir.path)}>
              <group position={dirPositions[i]}>
                <Planet
                  node={dir}
                  position={[0, 0, 0]}
                  level={1}
                  radius={core}
                  selected={selectedPaths.has(dir.path)}
                  searchMatch={searchMatchedPaths?.has(dir.path) ?? false}
                  showLabel={showLabels}
                  onSelect={(n) => onSelect([n])}
                  onOpen={onOpen}
                  onContextMenu={onContextMenu}
                />
                {subFiles.map((sub, j) => (
                  <OrbitalGroup
                    key={sub.path}
                    speed={orbitSpeed(childOrbit) * speedFactor(sub.path)}
                  >
                    <Planet
                      node={sub}
                      position={layoutChildPosition(j, subFiles.length, childOrbit)}
                      selected={selectedPaths.has(sub.path)}
                      searchMatch={searchMatchedPaths?.has(sub.path) ?? false}
                      showLabel={showLabels}
                      onSelect={(n) => onSelect([n])}
                      onOpen={onOpen}
                      onContextMenu={onContextMenu}
                    />
                  </OrbitalGroup>
                ))}
              </group>
            </OrbitalGroup>
          )
        })}
      </Select>

      <Star
        name={currentDir.name}
        radius={starRadius}
        selected={selectedPaths.has(currentDir.path)}
        onSelect={() => onSelect([currentDir])}
        onGoUp={onGoUp}
      />

      {/* 辉光后期特效：亮色（发光星体/恒星）泛光柔化（文档 §2.2 视觉美化） */}
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.35} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>

      <OrbitControls enableDamping dampingFactor={0.08} maxDistance={70} minDistance={2} />
    </>
  )
}
