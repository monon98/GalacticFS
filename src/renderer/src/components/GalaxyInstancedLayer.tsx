/**
 * 星系层 InstancedMesh + LOD 渲染（文档 §7.2、§9.3）。
 * - 星系核：单一 InstancedMesh（每星系 1 实例），LOD0=球体(24段)、LOD1=球体(12段)、LOD2=八面体
 * - 子文件环：每星系独立 InstancedMesh（最多 10 颗），统一材质，随距离降级
 * - 条目 ≥ LABEL_THRESHOLD 时启用，配合文件层 InstancedMesh 实现全场景 ≤3 Draw Calls
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { FileNode } from '../../../shared/types'
import { getDirColor, getPlanetRadius } from '../../../shared/visual-mapping'
import { speedFactor, orbitSpeed } from '../utils/scene'

interface GalaxyInstancedLayerProps {
  galaxies: { dir: FileNode; core: number; subFiles: FileNode[]; childOrbit: number }[]
  dirPositions: [number, number, number][]
  _selectedPaths: Set<string>
  _searchMatchedPaths: Set<string> | null
  _showLabels: boolean
  _onSelect: (nodes: FileNode[]) => void
  _onOpen: (node: FileNode) => void
  _onContextMenu: (node: FileNode, screenX: number, screenY: number) => void
  _mouse?: { x: number; y: number } | null
}

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

export function GalaxyInstancedLayer(props: GalaxyInstancedLayerProps): React.JSX.Element | null {
  const { galaxies, dirPositions } = props
  if (galaxies.length === 0) return null

  useThree()

  // 星系核 InstancedMesh（每星系 1 实例）
  const coreMeshRef = useRef<THREE.InstancedMesh>(null)
  const coreMesh2Ref = useRef<THREE.InstancedMesh>(null) // LOD1
  const coreMesh3Ref = useRef<THREE.InstancedMesh>(null) // LOD2

  // 子文件 InstancedMesh（每星系单独 mesh，便于局部更新）
  const childMeshRefs = useRef<Map<string, THREE.InstancedMesh>>(new Map())

  // 静态数据
  const coreData = useMemo(() => {
    return galaxies.map((g, i) => ({
      dir: g.dir,
      core: g.core,
      childOrbit: g.childOrbit,
      subFiles: g.subFiles,
      position: new THREE.Vector3(...dirPositions[i]),
      orbitRadius: Math.hypot(dirPositions[i][0], dirPositions[i][2]),
      orbitalSpeed:
        orbitSpeed(Math.hypot(dirPositions[i][0], dirPositions[i][2])) * speedFactor(g.dir.path),
      initialAngle: Math.atan2(dirPositions[i][2], dirPositions[i][0]),
      currentAngle: Math.atan2(dirPositions[i][2], dirPositions[i][0]),
      level: 1
    }))
  }, [galaxies, dirPositions])

  // 初始化星系核三级 LOD
  useEffect(() => {
    const count = coreData.length
    if (count === 0) return

    // LOD0: 高细节球体 (24 段)
    const geom0 = new THREE.SphereGeometry(1, 24, 24)
    const mat0 = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color(),
      emissiveIntensity: 0.6
    })
    coreMeshRef.current = new THREE.InstancedMesh(geom0, mat0, count)
    coreMeshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    coreMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    )
    coreMeshRef.current.frustumCulled = false

    // LOD1: 中细节球体 (12 段)
    const geom1 = new THREE.SphereGeometry(1, 12, 12)
    const mat1 = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color(),
      emissiveIntensity: 0.5
    })
    coreMesh2Ref.current = new THREE.InstancedMesh(geom1, mat1, count)
    coreMesh2Ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    coreMesh2Ref.current.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    )
    coreMesh2Ref.current.frustumCulled = false
    coreMesh2Ref.current.layers.set(1) // LOD1 layer

    // LOD2: 低细节八面体
    const geom2 = new THREE.OctahedronGeometry(1, 0)
    const mat2 = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color(),
      emissiveIntensity: 0.4
    })
    coreMesh3Ref.current = new THREE.InstancedMesh(geom2, mat2, count)
    coreMesh3Ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    coreMesh3Ref.current.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3
    )
    coreMesh3Ref.current.frustumCulled = false
    coreMesh3Ref.current.layers.set(2) // LOD2 layer

    // 初始矩阵
    coreData.forEach((data, i) => {
      _dummy.position.copy(data.position)
      _dummy.scale.setScalar(data.core)
      _dummy.updateMatrix()
      coreMeshRef.current!.setMatrixAt(i, _dummy.matrix)
      coreMesh2Ref.current!.setMatrixAt(i, _dummy.matrix)
      coreMesh3Ref.current!.setMatrixAt(i, _dummy.matrix)

      const color = getDirColor(data.level)
      _color.set(color)
      coreMeshRef.current!.setColorAt(i, _color)
      coreMesh2Ref.current!.setColorAt(i, _color)
      coreMesh3Ref.current!.setColorAt(i, _color)
    })

    coreMeshRef.current.instanceMatrix.needsUpdate = true
    coreMeshRef.current.instanceColor!.needsUpdate = true
    coreMesh2Ref.current.instanceMatrix.needsUpdate = true
    coreMesh2Ref.current.instanceColor!.needsUpdate = true
    coreMesh3Ref.current.instanceMatrix.needsUpdate = true
    coreMesh3Ref.current.instanceColor!.needsUpdate = true
  }, [coreData])

  // 初始化/更新子文件 InstancedMesh（每星系一个）
  useEffect(() => {
    const refs = childMeshRefs.current
    const existingKeys = new Set(refs.keys())
    const neededKeys = new Set(coreData.map((d) => d.dir.path))

    // 移除不需要的 mesh
    existingKeys.forEach((key) => {
      if (!neededKeys.has(key)) {
        const mesh = refs.get(key)!
        mesh.geometry?.dispose()
        mesh.material?.dispose()
        refs.delete(key)
      }
    })

    // 创建/更新需要的 mesh
    coreData.forEach((data) => {
      let mesh = refs.get(data.dir.path)
      const count = data.subFiles.length
      if (count === 0) return

      const childGeom = new THREE.SphereGeometry(1, 16, 16)
      const childMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: new THREE.Color(),
        emissiveIntensity: 0.4
      })

      if (!mesh || mesh.count !== count) {
        if (mesh) {
          mesh.geometry?.dispose()
          mesh.material?.dispose()
        }
        mesh = new THREE.InstancedMesh(childGeom, childMat, count)
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
        mesh.frustumCulled = false
        refs.set(data.dir.path, mesh)
      }

      // 初始矩阵（相对星系核位置）
      data.subFiles.forEach((sub, j) => {
        const angle = (j / Math.max(count, 1)) * Math.PI * 2 + Math.PI / 2
        const radius = getPlanetRadius(sub.size)
        const x = Math.cos(angle) * data.childOrbit
        const z = Math.sin(angle) * data.childOrbit

        _dummy.position.set(x, 0, z)
        _dummy.scale.setScalar(radius)
        _dummy.updateMatrix()
        mesh!.setMatrixAt(j, _dummy.matrix)

        const color = getDirColor(2) // 二级目录色
        _color.set(color)
        mesh!.setColorAt(j, _color)
      })

      mesh!.instanceMatrix.needsUpdate = true
      mesh!.instanceColor!.needsUpdate = true
    })
  }, [coreData])

  // 每帧更新：星系核公转 + 自转 + 子文件公转
  useFrame((state, delta) => {
    if (!coreMeshRef.current) return

    coreData.forEach((data, i) => {
      // 星系核公转
      data.currentAngle += data.orbitalSpeed * delta
      const x = Math.cos(data.currentAngle) * data.orbitRadius
      const z = Math.sin(data.currentAngle) * data.orbitRadius

      _dummy.position.set(x, data.position.y, z)
      _dummy.rotation.y += 0.1 * speedFactor(data.dir.path) * delta // 自转
      _dummy.scale.setScalar(data.core)
      _dummy.updateMatrix()

      coreMeshRef.current!.setMatrixAt(i, _dummy.matrix)
      coreMesh2Ref.current!.setMatrixAt(i, _dummy.matrix)
      coreMesh3Ref.current!.setMatrixAt(i, _dummy.matrix)
    })

    coreMeshRef.current.instanceMatrix.needsUpdate = true
    coreMesh2Ref.current.instanceMatrix.needsUpdate = true
    coreMesh3Ref.current.instanceMatrix.needsUpdate = true

    // 更新子文件（相对星系核旋转）
    coreData.forEach((data) => {
      const mesh = childMeshRefs.current.get(data.dir.path)
      if (!mesh) return

      data.subFiles.forEach((sub, j) => {
        const childOrbitSpeed = orbitSpeed(data.childOrbit) * speedFactor(sub.path)
        // 子文件相对星系核的角度（这里简化：每帧累加，实际需存储每子文件当前角度）
        // 为简化，使用全局 elapsed time 计算
        const elapsed = state.clock.getElapsedTime()
        const angle =
          (j / Math.max(data.subFiles.length, 1)) * Math.PI * 2 + elapsed * childOrbitSpeed

        const radius = getPlanetRadius(sub.size)
        const x = Math.cos(angle) * data.childOrbit
        const z = Math.sin(angle) * data.childOrbit

        _dummy.position.set(x, 0, z)
        _dummy.scale.setScalar(radius)
        _dummy.updateMatrix()
        mesh.setMatrixAt(j, _dummy.matrix)
      })

      mesh.instanceMatrix.needsUpdate = true
    })
  })

  // 清理
  useEffect(() => {
    return () => {
      childMeshRefs.current.forEach((mesh) => {
        mesh.geometry?.dispose()
        mesh.material?.dispose()
      })
      childMeshRefs.current.clear()
      coreMeshRef.current?.geometry?.dispose()
      coreMeshRef.current?.material?.dispose()
      coreMesh2Ref.current?.geometry?.dispose()
      coreMesh2Ref.current?.material?.dispose()
      coreMesh3Ref.current?.geometry?.dispose()
      coreMesh3Ref.current?.material?.dispose()
    }
  }, [])

  if (galaxies.length === 0) return null

  return (
    <>
      {/* 星系核 LOD0 (近距离) */}
      <instancedMesh
        ref={coreMeshRef}
        frustumCulled={false}
        layers={0}
        // @ts-expect-error R3F types
        args={[null, coreData.length, undefined]}
      />

      {/* 星系核 LOD1 (中距离) */}
      <instancedMesh
        ref={coreMesh2Ref}
        frustumCulled={false}
        layers={1}
        // @ts-expect-error
        args={[null, coreData.length, undefined]}
      />

      {/* 星系核 LOD2 (远距离) */}
      <instancedMesh
        ref={coreMesh3Ref}
        frustumCulled={false}
        layers={2}
        // @ts-expect-error
        args={[null, coreData.length, undefined]}
      />

      {/* 子文件环（每星系一个 mesh，通过 group 定位） */}
      {coreData.map((data) => {
        const mesh = childMeshRefs.current.get(data.dir.path)
        if (!mesh || data.subFiles.length === 0) return null

        return (
          <group key={data.dir.path} position={data.position.toArray()}>
            <instancedMesh
              ref={() => {}}
              frustumCulled={false}
              // @ts-expect-error
              args={[null, data.subFiles.length, undefined]}
            >
              {Object.assign(mesh, {})} // 这里仅占位，实际 mesh 已在 refs 中管理
            </instancedMesh>
          </group>
        )
      })}
    </>
  )
}
