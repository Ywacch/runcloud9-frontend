/**
 * Prepare a canvas SVG export for the landing hero:
 * - attach data-export-node metadata from nearby label chrome
 * - remove tiny on-canvas labels / status dots
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetPath = path.resolve(__dirname, '../src/assets/canvas-hero.svg')

function removeSubtreeByAttr(svg, attrName) {
  const needle = `${attrName}=`
  let out = svg
  for (;;) {
    const startAttr = out.indexOf(needle)
    if (startAttr < 0) break
    const gStart = out.lastIndexOf('<g', startAttr)
    if (gStart < 0) break
    let i = gStart
    let depth = 0
    let removed = false
    while (i < out.length) {
      if (
        out.startsWith('<g', i) &&
        (out[i + 2] === ' ' || out[i + 2] === '>' || out[i + 2] === '\n')
      ) {
        depth += 1
        i = out.indexOf('>', i) + 1
        continue
      }
      if (out.startsWith('</g>', i)) {
        depth -= 1
        i += 4
        if (depth === 0) {
          out = out.slice(0, gStart) + out.slice(i)
          removed = true
          break
        }
        continue
      }
      i += 1
    }
    if (!removed) break
  }
  return out
}

function parseLabels(svg) {
  const labels = []
  const re =
    /data-node-chrome="([^"]+)"[^>]*>\s*<text\s+x="([^"]+)"\s+y="([^"]+)"[^>]*>([^<]+)<\/text>/g
  for (const m of svg.matchAll(re)) {
    labels.push({
      id: m[1],
      x: Number(m[2]),
      y: Number(m[3]),
      label: m[4],
    })
  }
  return labels
}

const ARCHETYPE_BRAND = {
  cache: 'redis',
  database: 'postgresql',
  worker: 'go',
  'message-queue': 'rabbitmq',
  'app-server': 'go',
  'load-balancer': 'nginx',
}

function normalizeEngine(raw) {
  if (!raw) return null
  const key = String(raw).trim().toLowerCase()
  if (!key || key === 'generic') return null
  if (key === 'gopher') return 'go'
  if (key === 'postgres') return 'postgresql'
  return key
}

function resolveBrandKey(attrs, bodySnippet, archetype) {
  const engineMatch = attrs.match(/\bdata-engine="([^"]+)"/)
  const fromEngine = normalizeEngine(engineMatch?.[1])
  if (fromEngine) return fromEngine

  const faceMatch = bodySnippet.match(/\bdata-face-logo="([^"]+)"/)
  const fromFace = normalizeEngine(faceMatch?.[1])
  if (fromFace) return fromFace

  const nestedEngine = bodySnippet.match(/\bdata-engine="([^"]+)"/)
  const fromNested = normalizeEngine(nestedEngine?.[1])
  if (fromNested) return fromNested

  return ARCHETYPE_BRAND[archetype] ?? 'generic'
}

function parseGlyphs(svg) {
  const glyphs = []
  const re =
    /<g\b([^>]*\btransform="translate\(([^)]+)\)"[^>]*\bdata-archetype="([^"]+)"[^>]*)>/g
  for (const m of svg.matchAll(re)) {
    const [tx, ty] = m[2].trim().split(/\s+/).map(Number)
    glyphs.push({
      index: m.index ?? 0,
      endTag: (m.index ?? 0) + m[0].length,
      attrs: m[1],
      x: tx,
      y: ty,
      archetype: m[3],
    })
  }
  const re2 =
    /<g\b([^>]*\bdata-archetype="([^"]+)"[^>]*\btransform="translate\(([^)]+)\)"[^>]*)>/g
  for (const m of svg.matchAll(re2)) {
    if (glyphs.some((g) => g.index === m.index)) continue
    const [tx, ty] = m[3].trim().split(/\s+/).map(Number)
    glyphs.push({
      index: m.index ?? 0,
      endTag: (m.index ?? 0) + m[0].length,
      attrs: m[1],
      x: tx,
      y: ty,
      archetype: m[2],
    })
  }
  return glyphs.sort((a, b) => a.index - b.index)
}

function nearestLabel(glyph, labels, used) {
  let best = null
  let bestDist = Infinity
  for (const lab of labels) {
    if (used.has(lab.id)) continue
    const d = Math.hypot(lab.x - glyph.x, lab.y - glyph.y)
    if (d < bestDist) {
      bestDist = d
      best = lab
    }
  }
  return best && bestDist < 200 ? best : null
}

const ARCHETYPE_TITLE = {
  cache: 'Cache',
  database: 'Database',
  worker: 'Worker',
  'message-queue': 'Message queue',
  'app-server': 'App server',
  'load-balancer': 'Load balancer',
  client: 'Client',
}

const svg = fs.readFileSync(assetPath, 'utf8')
const labels = parseLabels(svg)
const glyphs = parseGlyphs(svg)
console.log('labels', labels.length, 'glyphs', glyphs.length)

const used = new Set()
const injections = []
for (const g of glyphs) {
  const lab = nearestLabel(g, labels, used)
  if (lab) used.add(lab.id)
  const label = lab?.label ?? ARCHETYPE_TITLE[g.archetype] ?? g.archetype
  const id = lab?.id ?? `${g.archetype}-${Math.round(g.x)}-${Math.round(g.y)}`
  const bodySnippet = svg.slice(g.endTag, g.endTag + 12000)
  const engine = resolveBrandKey(g.attrs, bodySnippet, g.archetype)
  injections.push({
    endTag: g.endTag,
    attrs: ` data-export-node="" data-node-id="${id}" data-node-label="${label.replace(/"/g, '')}" data-node-archetype="${g.archetype}" data-node-engine="${engine}"`,
  })
}

let next = svg
for (const inj of [...injections].sort((a, b) => b.endTag - a.endTag)) {
  const before = next.slice(0, inj.endTag - 1)
  const after = next.slice(inj.endTag - 1)
  if (before.includes('data-export-node')) continue
  next = `${before}${inj.attrs}${after}`
}

next = removeSubtreeByAttr(next, 'data-node-label-chrome')

fs.writeFileSync(assetPath, next)
console.log('wrote', assetPath)
console.log(
  'export nodes',
  [...next.matchAll(/data-export-node/g)].length,
  'label chrome left',
  next.includes('data-node-label-chrome'),
)
console.log(
  'labels',
  [...next.matchAll(/data-node-label="([^"]+)"/g)].map((m) => m[1]),
)
