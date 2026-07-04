/** Parse Kubernetes CPU quantity to millicores (matches k8s resource.Quantity). */
export function parseCpuMilli(value: string): number {
  const s = value.trim()
  if (!s) return 0
  if (s.endsWith('m')) {
    return Number.parseInt(s.slice(0, -1), 10) || 0
  }
  const cores = Number.parseFloat(s)
  if (!Number.isFinite(cores)) return 0
  return Math.round(cores * 1000)
}

/** Format millicores as a Kubernetes CPU string. */
export function formatCpuMilli(milli: number): string {
  if (milli <= 0) return '0'
  if (milli % 1000 === 0) return String(milli / 1000)
  return `${milli}m`
}

/** Parse Kubernetes memory quantity to bytes. */
export function parseMemoryBytes(value: string): number {
  const s = value.trim()
  if (!s) return 0
  const match = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|Ei|K|M|G|T|P|E)?$/i.exec(s)
  if (!match) return 0
  const num = Number.parseFloat(match[1])
  if (!Number.isFinite(num)) return 0
  const suffix = match[2] ?? ''
  switch (suffix) {
    case 'Ki':
      return num * 1024
    case 'Mi':
      return num * 1024 ** 2
    case 'Gi':
      return num * 1024 ** 3
    case 'Ti':
      return num * 1024 ** 4
    case 'Pi':
      return num * 1024 ** 5
    case 'Ei':
      return num * 1024 ** 6
    case 'K':
      return num * 1000
    case 'M':
      return num * 1000 ** 2
    case 'G':
      return num * 1000 ** 3
    case 'T':
      return num * 1000 ** 4
    case 'P':
      return num * 1000 ** 5
    case 'E':
      return num * 1000 ** 6
    default:
      return num
  }
}

/** Format bytes as Mi/Gi when exact (for budget breakdown rows). */
export function formatMemoryBytes(bytes: number): string {
  if (bytes <= 0) return '0'
  const gi = bytes / 1024 ** 3
  if (Math.abs(gi - Math.round(gi)) < 1e-9) return `${Math.round(gi)}Gi`
  const mi = bytes / 1024 ** 2
  if (Math.abs(mi - Math.round(mi)) < 1e-9) return `${Math.round(mi)}Mi`
  const ki = bytes / 1024
  if (Math.abs(ki - Math.round(ki)) < 1e-9) return `${Math.round(ki)}Ki`
  return `${Math.round(bytes)}`
}

export function scaleCpuMilli(value: string, replicas: number): string {
  return formatCpuMilli(parseCpuMilli(value) * replicas)
}

export function scaleMemoryBytes(value: string, replicas: number): string {
  return formatMemoryBytes(parseMemoryBytes(value) * replicas)
}
