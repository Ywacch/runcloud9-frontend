export function scaleLagErrorLabel(n: number | undefined | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const count = Math.round(n)
  if (count <= 0) return null
  return `${count} errors while replicas catch up`
}
