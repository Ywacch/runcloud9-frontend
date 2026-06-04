export function nodeToIso(pos: [number, number, number]): { col: number; row: number } {
  return {
    col: Math.round(pos[0] / 2),
    row: Math.round(pos[2] / 2),
  }
}

export function isoToNode(col: number, row: number): [number, number, number] {
  return [col * 2, 0.3, row * 2]
}
