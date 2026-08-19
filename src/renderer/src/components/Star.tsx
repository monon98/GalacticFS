/**
 * 中心恒星组件：代表当前浏览目录本身（红色恒星，用户偏好）。
 * 半径由外层按"中心必须最大"原则传入（max(子星体) × 1.5）。
 * 双击返回上级目录；点击选中（便于框选时归并）。
 * 无星环：圆环类装饰被用户偏好覆盖（恒星/行星/根目录均不绘制）。
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

export interface StarProps {
  name: string
  /** 恒星半径（中心最大原则，由场景层计算） */
  radius: number
  selected: boolean
  onSelect: () => void
  /** 双击返回上级目录 */
  onGoUp: () => void
}

export function Star({ name, radius, selected, onSelect, onGoUp }: StarProps): React.JSX.Element {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  // 恒星缓慢自转 + 星环公转感
  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.1
    }
  })

  const scale = selected || hovered ? 1.15 : 1

  return (
    <group ref={group} scale={scale}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onGoUp()
        }}
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
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color="#FF3B30"
          emissive="#FF3B30"
          emissiveIntensity={hovered ? 1.2 : 0.6}
        />
      </mesh>
      <HtmlLabel name={name} visible={hovered} radius={radius} />
    </group>
  )
}

function HtmlLabel({
  name,
  visible,
  radius
}: {
  name: string
  visible: boolean
  radius: number
}): React.JSX.Element {
  return (
    <Html
      position={[0, radius * 2.2, 0]}
      center
      distanceFactor={8}
      style={{
        pointerEvents: 'none',
        color: '#F5C842',
        fontSize: '13px',
        opacity: visible ? 1 : 0.6
      }}
    >
      {name}
    </Html>
  )
}
