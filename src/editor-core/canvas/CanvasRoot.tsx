import { Canvas } from '@react-three/fiber'
import { MapControls, OrthographicCamera } from '@react-three/drei'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { CameraReset } from './CameraReset'
import { GridFloor } from './GridFloor'
import { SceneGraph } from './SceneGraph'
import { SpawnFromScreen } from './SpawnFromScreen'

function IsoCamera() {
  const ref = useRef<THREE.OrthographicCamera>(null)
  useLayoutEffect(() => {
    ref.current?.lookAt(0, 0, 0)
  }, [])
  return (
    <OrthographicCamera
      ref={ref}
      makeDefault
      position={[10, 10, 10]}
      zoom={60}
      near={0.1}
      far={2000}
    />
  )
}

export function CanvasRoot() {
  const planeRef = useRef<THREE.Mesh>(null)

  return (
    <div className="h-full w-full">
      <Canvas
        gl={{ antialias: true, alpha: false }}
        shadows={false}
        frameloop="always"
        flat
        style={{ background: '#f5f5f5' }}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color('#f5f5f5')
          gl.setClearColor(0xf5f5f5, 1)
        }}
      >
        <IsoCamera />
        <MapControls
          enableRotate={false}
          enablePan
          enableZoom
          screenSpacePanning={false}
          minZoom={20}
          maxZoom={200}
          // Default MapControls uses LEFT = pan, which fights node drag/clicks. Left = "rotate"
          // with rotation disabled is a no-op; pan with right drag, zoom with middle (three.js defaults).
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 12, 8]} intensity={1.2} castShadow={false} />
        <directionalLight position={[-6, 6, -6]} intensity={0.35} color="#ffffff" />
        <hemisphereLight args={['#ffffff', '#b0b8c8', 0.4]} />
        <GridFloor planeRef={planeRef} />
        <SceneGraph />
        <SpawnFromScreen />
        <CameraReset />
      </Canvas>
    </div>
  )
}
