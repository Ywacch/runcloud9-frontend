/**
 * Builds the canvas component spritesheet from the grayscale SVG sources.
 *
 *   pnpm build:sprites
 *
 * Reads  src/assets/sprites/{cache,server,database,worker,loadbalancer,queue}.svg
 * Writes public/spritesheets/components.png + components.json (TexturePacker hash format)
 *
 * Each SVG is rasterized at RASTER_SCALE x its viewBox size (tile-width 128 -> 256px
 * so sprites stay crisp at zoom), trimmed, then shelf-packed with 2px padding.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src', 'assets', 'sprites')
const OUT_DIR = path.join(ROOT, 'public', 'spritesheets')

/** 1 SVG viewBox unit -> 2 atlas px (TILE_W 128 renders from a 256px frame). */
const RASTER_SCALE = 2
const SVG_DEFAULT_DPI = 72
const PADDING = 2
const MAX_ATLAS_SIZE = 2048

/** Source file (without .svg) -> atlas frame name. */
const FRAME_SOURCES = [
  ['cache', 'cache_base'],
  ['server', 'server_base'],
  ['database', 'database_base'],
  ['worker', 'worker_base'],
  ['loadbalancer', 'loadbalancer_base'],
  ['queue', 'queue_base'],
]

function parseViewBox(svgText, file) {
  const m = svgText.match(/viewBox="([\d.\s-]+)"/)
  if (!m) throw new Error(`${file}: missing viewBox`)
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number)
  if (!(w > 0) || !(h > 0)) throw new Error(`${file}: invalid viewBox "${m[1]}"`)
  return { w, h }
}

async function rasterize(file) {
  const svgPath = path.join(SRC_DIR, `${file}.svg`)
  const svgText = await readFile(svgPath, 'utf8')
  const viewBox = parseViewBox(svgText, file)

  const sourceW = Math.round(viewBox.w * RASTER_SCALE)
  const sourceH = Math.round(viewBox.h * RASTER_SCALE)

  const { data, info } = await sharp(Buffer.from(svgText), {
    density: SVG_DEFAULT_DPI * RASTER_SCALE,
  })
    .ensureAlpha()
    .png()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .toBuffer({ resolveWithObject: true })

  if (info.width <= 0 || info.height <= 0) {
    throw new Error(`${file}.svg rasterized to an empty image`)
  }

  return {
    png: data,
    trimmedW: info.width,
    trimmedH: info.height,
    // sharp reports trim offsets as negative shifts from the original origin.
    trimX: Math.abs(info.trimOffsetLeft ?? 0),
    trimY: Math.abs(info.trimOffsetTop ?? 0),
    sourceW,
    sourceH,
  }
}

/** Simple shelf packer: rows of sprites sorted by height, 2px padding. */
function shelfPack(items) {
  const sorted = [...items].sort((a, b) => b.trimmedH - a.trimmedH)
  let x = PADDING
  let y = PADDING
  let shelfH = 0
  let atlasW = 0

  for (const item of sorted) {
    if (x + item.trimmedW + PADDING > MAX_ATLAS_SIZE) {
      x = PADDING
      y += shelfH + PADDING
      shelfH = 0
    }
    item.x = x
    item.y = y
    x += item.trimmedW + PADDING
    shelfH = Math.max(shelfH, item.trimmedH)
    atlasW = Math.max(atlasW, x)
  }

  const atlasH = y + shelfH + PADDING
  if (atlasW > MAX_ATLAS_SIZE || atlasH > MAX_ATLAS_SIZE) {
    throw new Error(`atlas ${atlasW}x${atlasH} exceeds ${MAX_ATLAS_SIZE}`)
  }
  // Round up to even dimensions (friendlier for GPU mipmap-less uploads).
  return { atlasW: atlasW + (atlasW % 2), atlasH: atlasH + (atlasH % 2) }
}

async function main() {
  const items = []
  for (const [file, frameName] of FRAME_SOURCES) {
    const r = await rasterize(file)
    items.push({ file, frameName, ...r })
    console.log(
      `rasterized ${file}.svg -> ${frameName} ` +
        `(${r.trimmedW}x${r.trimmedH} trimmed of ${r.sourceW}x${r.sourceH})`,
    )
  }

  const { atlasW, atlasH } = shelfPack(items)

  const composite = items.map((item) => ({
    input: item.png,
    left: item.x,
    top: item.y,
  }))

  await mkdir(OUT_DIR, { recursive: true })
  await sharp({
    create: {
      width: atlasW,
      height: atlasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png()
    .toFile(path.join(OUT_DIR, 'components.png'))

  const frames = {}
  for (const item of items) {
    frames[item.frameName] = {
      frame: { x: item.x, y: item.y, w: item.trimmedW, h: item.trimmedH },
      rotated: false,
      trimmed: item.trimX > 0 || item.trimY > 0,
      spriteSourceSize: {
        x: item.trimX,
        y: item.trimY,
        w: item.trimmedW,
        h: item.trimmedH,
      },
      sourceSize: { w: item.sourceW, h: item.sourceH },
      pivot: { x: 0.5, y: 0.5 },
    }
  }

  const json = {
    frames,
    meta: {
      app: 'cloud9-frontend scripts/build-sprite-atlas.mjs',
      version: '1.0',
      image: 'components.png',
      format: 'RGBA8888',
      size: { w: atlasW, h: atlasH },
      scale: '1',
    },
  }
  await writeFile(
    path.join(OUT_DIR, 'components.json'),
    `${JSON.stringify(json, null, 2)}\n`,
  )

  console.log(`atlas ${atlasW}x${atlasH} -> ${path.relative(ROOT, OUT_DIR)}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
