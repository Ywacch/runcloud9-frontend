import * as THREE from 'three'

export function lightenHex(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  c.r = Math.min(1, c.r + amount)
  c.g = Math.min(1, c.g + amount)
  c.b = Math.min(1, c.b + amount)
  return `#${c.getHexString()}`
}

export function darkenHex(hex: string, factor: number): string {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}
