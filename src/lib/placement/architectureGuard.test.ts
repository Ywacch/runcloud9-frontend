import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { GUARD_ALLOWLIST } from './guardAllowList'

const patterns = [
  /canvasToBackend\[/g,
  /backendComponentToCanvasType\[/g,
  /\.type === 'cache'/g,
  /\.type === 'message_queue'/g,
  /type === 'cache'/g,
  /type === 'message_queue'/g,
]

const exemptPrefixes = ['lib/placement/', 'lib/typeMapping.ts']

function countHits(source: string): number {
  let n = 0
  for (const re of patterns) {
    re.lastIndex = 0
    const m = source.match(re)
    if (m) n += m.length
  }
  return n
}

const skipDirs = new Set(['node_modules', 'dist', '.git'])

function walk(dir: string, root: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (skipDirs.has(name)) continue
    const full = path.join(dir, name)
    const rel = path.relative(root, full).replace(/\\/g, '/')
    if (fs.statSync(full).isDirectory()) {
      if (exemptPrefixes.some((p) => rel.startsWith(p))) continue
      walk(full, root, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue
    out.push(full)
  }
  return out
}

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('architectureGuard', () => {
  it('does not grow role-from-type pattern hits', { timeout: 30_000 }, () => {
    const files = walk(srcRoot, srcRoot)
    const missing: string[] = []
    const over: string[] = []
    for (const file of files) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, '/')
      if (exemptPrefixes.some((p) => rel.startsWith(p))) continue
      const hits = countHits(fs.readFileSync(file, 'utf8'))
      if (hits === 0) continue
      const allowed = GUARD_ALLOWLIST[rel]
      if (allowed === undefined) {
        missing.push(`${rel}: ${hits}`)
        continue
      }
      if (hits > allowed) {
        over.push(`${rel}: ${hits} > ${allowed}`)
      }
    }
    if (missing.length > 0 || over.length > 0) {
      throw new Error(
        `guard drift\nmissing:\n${missing.join('\n')}\nover:\n${over.join('\n')}`,
      )
    }
  })
})