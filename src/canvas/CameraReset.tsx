import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RESET_CAMERA } from '../lib/spawnEvents'

export function CameraReset() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const onReset = () => {
      camera.position.set(10, 10, 10)
      const ortho = camera as THREE.OrthographicCamera
      ortho.zoom = 60
      ortho.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      if (controls && 'target' in controls && 'update' in controls) {
        const c = controls as { target: THREE.Vector3; update: () => void }
        c.target.set(0, 0, 0)
        c.update()
      }
      invalidate()
    }
    window.addEventListener(RESET_CAMERA, onReset)
    return () => window.removeEventListener(RESET_CAMERA, onReset)
  }, [camera, controls, invalidate])

  return null
}
