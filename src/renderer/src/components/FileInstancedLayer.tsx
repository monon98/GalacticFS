/**
 * 文件层 InstancedMesh 渲染：将所有文件行星合并为单一 Draw Call（文档 §7.2 性能优化）。
 * 条目 ≥ 200 时自动启用（LABEL_THRESHOLD 复用），保证 ≥30 FPS。
 * 支持：轨道公转、自转、选中高亮、悬停发光、搜索脉冲、点击/右键交互。
 * 缩略图暂不支持（仅极少数图片/视频），回退类型色。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { FileNode } from '../../../shared/types'
import { FILE_COLOR, getPlanetRadius } from '../../../shared/visual-mapping'
import { speedFactor, orbitSpeed } from '../utils/scene'

interface InstanceData {
  node: FileNode
  radius: number
  orbitRadius: number
  orbitalSpeed: number
  spinSpeed: number
  initialAngle: number
  currentAngle: number
}

interface FileInstancedLayerProps {
  files: FileNode[]
  positions: [number, number, number][]
  selectedPaths: Set<string>
  searchMatchedPaths: Set<string> | null
  showLabels: boolean
  onSelect: (nodes: FileNode[]) => void
  onOpen: (node: FileNode) => void
  onContextMenu: (node: FileNode, screenX: number, screenY: number) => void
  /** 鼠标归一化坐标（-1~1），由父组件传入 */
  mouse?: { x: number; y: number } | null
}

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()
const _raycaster = new THREE.Raycaster()
// 复用的归一化坐标：Raycaster.setFromCamera 要求 Vector2 实例，
// 而父组件传入的 mouse 只是普通 { x, y } 对象
const _pointer = new THREE.Vector2()

export function FileInstancedLayer({
  files,
  positions,
  selectedPaths,
  searchMatchedPaths,
  showLabels,
  onSelect,
  onOpen,
  onContextMenu,
  mouse = null
}: FileInstancedLayerProps): React.JSX.Element | null {
  const { camera, size } = useThree()
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // 几何体和材质在 useMemo 中创建，避免重复创建
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 24, 24), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: FILE_COLOR,
        emissive: FILE_COLOR,
        emissiveIntensity: 0.45,
        vertexColors: true
      }),
    []
  )

  // 静态实例数据（仅依赖 files/positions，不随帧变化）
  const instanceData = useMemo<InstanceData[]>(() => {
    return files.map((node, i) => {
      const pos = positions[i]
      const orbitRadius = Math.hypot(pos[0], pos[2])
      const radius = getPlanetRadius(node.size)
      return {
        node,
        radius,
        orbitRadius,
        orbitalSpeed: orbitSpeed(orbitRadius) * speedFactor(node.path),
        spinSpeed: 0.4 * speedFactor(node.path),
        initialAngle: Math.atan2(pos[2], pos[0]),
        currentAngle: Math.atan2(pos[2], pos[0])
      }
    })
  }, [files, positions])

  const instanceCount = instanceData.length

  // 初始化 InstancedMesh
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    if (mesh.count !== instanceCount) {
      mesh.count = instanceCount
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(instanceCount * 3),
        3
      )
      mesh.geometry = geometry
      mesh.material = material
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    }

    // 初始矩阵
    instanceData.forEach((data, i) => {
      _dummy.position.setFromSphericalCoords(data.orbitRadius, Math.PI / 2, data.initialAngle)
      _dummy.scale.setScalar(data.radius)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      _color.set(FILE_COLOR)
      mesh.setColorAt(i, _color)
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
  }, [instanceCount, instanceData, geometry, material])

  // 每帧更新：公转 + 自转 + 视觉反馈
  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const elapsed = state.clock.getElapsedTime()

    // 射线检测悬停（使用父组件传入的 mouse）
    if (mouse && size.width > 0 && size.height > 0) {
      _pointer.set(mouse.x, mouse.y)
      _raycaster.setFromCamera(_pointer, camera)
      const intersects = _raycaster.intersectObject(mesh)
      if (intersects.length > 0) {
        const idx = intersects[0].instanceId
        if (idx !== undefined) {
          setHoveredIndex(idx)
        }
      } else {
        setHoveredIndex(null)
      }
    }

    // 更新每实例矩阵
    instanceData.forEach((data, i) => {
      // 公转
      data.currentAngle += data.orbitalSpeed * delta

      // 自转（绕 Y 轴）
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        data.spinSpeed * delta
      )

      // 位置
      const x = Math.cos(data.currentAngle) * data.orbitRadius
      const z = Math.sin(data.currentAngle) * data.orbitRadius

      _dummy.position.set(x, 0, z)
      _dummy.quaternion.multiply(spinQuat)
      _dummy.scale.setScalar(data.radius)

      // 视觉缩放：选中/悬停/搜索脉冲
      const isSelected = selectedPaths.has(data.node.path)
      const isHovered = hoveredIndex === i
      const isSearchMatch = searchMatchedPaths?.has(data.node.path) ?? false

      let scale = data.radius
      if (isSelected || isHovered) scale *= 1.15
      if (isSearchMatch) scale *= 1 + Math.abs(Math.sin(elapsed * 6)) * 0.35

      _dummy.scale.setScalar(scale)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      // 颜色反馈：通过 instanceColor 传递发光强度（R 通道）
      // 基础 0.45，悬停/选中 1.0，搜索脉冲 0.8
      let glow = 0.45
      if (isSelected || isHovered) glow = 1.0
      else if (isSearchMatch) glow = 0.8
      _color.setRGB(glow, glow, glow)
      mesh.setColorAt(i, _color)
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
  })

  // 无文件时不渲染
  if (files.length === 0) return null

  return (
    <>
      <instancedMesh
        ref={meshRef}
        frustumCulled={false}
        count={instanceCount}
        // @ts-expect-error R3F InstancedMesh types require args but we provide geometry/material as props
        args={[undefined, instanceCount, undefined]}
        geometry={geometry}
        material={material}
        onClick={(e) => {
          const idx = e.instanceId
          if (idx !== undefined && files[idx]) {
            e.stopPropagation()
            onSelect([files[idx]])
          }
        }}
        onDoubleClick={(e) => {
          const idx = e.instanceId
          if (idx !== undefined && files[idx]) {
            e.stopPropagation()
            onOpen(files[idx])
          }
        }}
        onContextMenu={(e) => {
          const idx = e.instanceId
          if (idx !== undefined && files[idx]) {
            e.stopPropagation()
            onContextMenu(files[idx], e.nativeEvent.clientX, e.nativeEvent.clientY)
          }
        }}
      />

      {/* 标签：跟随轨道位置（使用当前帧计算的位置） */}
      {showLabels &&
        instanceData.map((data) => (
          <Html
            key={data.node.path}
            position={[
              Math.cos(data.currentAngle) * data.orbitRadius,
              2.1 * (data.radius / getPlanetRadius(data.node.size)),
              Math.sin(data.currentAngle) * data.orbitRadius
            ]}
            center
            distanceFactor={6}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="planet-label" style={{ opacity: 0.8 }}>
              {data.node.name}
            </span>
          </Html>
        ))}
    </>
  )
}
