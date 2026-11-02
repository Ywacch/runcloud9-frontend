const MIB = 1024 * 1024

export function cacheMemoryAmount(bytes: number): { text: string; unit: 'KiB' | 'MiB' } {
  if (!Number.isFinite(bytes) || bytes <= 0) return { text: '0', unit: 'MiB' }
  if (bytes < MIB) {
    return { text: String(Math.max(1, Math.round(bytes / 1024))), unit: 'KiB' }
  }
  return { text: String(Math.round(bytes / MIB)), unit: 'MiB' }
}
