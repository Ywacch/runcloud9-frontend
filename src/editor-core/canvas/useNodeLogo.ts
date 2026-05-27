import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { resolveNodeLogo } from './nodeLogoMap'

/** Cap logo badges — off for now; caps use solid accent color in ProceduralNodeShape. */
export const NODE_LOGOS_ON_CAPS_ENABLED = false

export function useNodeLogo(nodeType: string): THREE.Texture | null {
  const path = NODE_LOGOS_ON_CAPS_ENABLED ? resolveNodeLogo(nodeType) : null
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!path) {
      setTexture(null)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(128, 128, 110, 0, Math.PI * 2)
    ctx.fill()

    const tex = new THREE.CanvasTexture(canvas)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 38, 38, 180, 180)
      tex.needsUpdate = true
      setTexture(tex)
    }
    img.src = path

    return () => {
      tex.dispose()
    }
  }, [path])

  return texture
}
