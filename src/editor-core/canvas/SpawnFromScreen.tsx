import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { placeFromPicker } from '../../lib/pickerPlacement'
import { SPAWN_AT_SCREEN, type SpawnAtScreenDetail } from '../../lib/spawnEvents'
import { useCanvasStore } from '../stores/canvasStore'

/** Listens for DOM drag-drop / bridge events and spawns nodes on the Y=0 plane. */
export function SpawnFromScreen() {
  const { camera, gl, invalidate } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const fn = (ev: Event) => {
      const e = ev as CustomEvent<SpawnAtScreenDetail>
      const { clientX, clientY, nodeType } = e.detail
      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const pt = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(plane, pt)) return
      const x = Math.round(pt.x)
      const z = Math.round(pt.z)
      const state = useCanvasStore.getState()
      placeFromPicker({
        nodeType,
        position: [x, 0.3, z],
        nodes: state.nodes,
        addNode: state.addNode,
        updateNodeConfig: state.updateNodeConfig,
        selectNode: state.selectNode,
      })
      state.setPlacingNodeType(null)
      invalidate()
    }
    window.addEventListener(SPAWN_AT_SCREEN, fn)
    return () => window.removeEventListener(SPAWN_AT_SCREEN, fn)
  }, [camera, gl, invalidate, raycaster])

  return null
}
