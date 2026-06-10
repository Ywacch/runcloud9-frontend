# Canvas component sprites (SVG sources)

Grayscale isometric SVGs used as the source of truth for the tinted component
spritesheet. PixiJS applies brand colors at runtime via `.tint`; do not bake
product colors into these files.

## Archetypes and viewBox dimensions

| File | Atlas frame | Archetype | viewBox (w × h) | Replica layout |
|------|-------------|-----------|-----------------|----------------|
| `cache.svg` | `cache_base` | SLAB-STACK | 132 × 92 | Vertical stack |
| `server.svg` | `server_base` | SLAB-STACK | 132 × 112 | Vertical stack |
| `database.svg` | `database_base` | DISC-STACK | 132 × 104 | Vertical stack |
| `worker.svg` | `worker_base` | DISC-STACK | 132 × 86 | Vertical stack |
| `loadbalancer.svg` | `loadbalancer_base` | HEX-PRISM | 128 × 137.556 | Singleton |
| `queue.svg` | `queue_base` | HEX-TUBE | 132 × 104 | Horizontal row |

Each file draws **one tier** of the shape. Runtime stacking (collapsed) and
fan-out (expanded) are handled in `SpriteComponent.ts` using offsets from
`replicaSlots.ts`.

## SVG authoring rules

- `viewBox` only on the root `<svg>` — no `width` / `height` attributes
- No external fonts, CSS imports, filters, or nested `<svg>` wrappers
- All fills use `fill-rule="evenodd"`
- Outer silhouette stroke: `stroke-width="2"` on the enclosing path
- Grayscale ramp: top/bright `#ffffff`, left/mid `#b4b4b4`, right/dark `#6e6e6e`
- SLAB-STACK and DISC-STACK: wrap geometry in `<g transform="translate(...)">`
- HEX-PRISM (`loadbalancer.svg`): no transform — paths in viewBox coordinates

Geometry is modeled on the Cloudcraft reference exports under
`throwaway/cloudcraft templates/` (face ordering and iso proportions), not
their brand colors.

## Adding a new component

1. Add `{name}.svg` in this directory following the rules above.
2. Register the frame in `scripts/build-sprite-atlas.mjs` (`FRAME_SOURCES`).
3. Map the canvas node type in `src/canvas/sprites/spriteFrames.ts` (frame
   name, tint hex, replica `strategy`: `stack` | `row` | `singleton`).
4. Tune seat alignment in `src/canvas/config/spriteLayout.ts` (`scale`,
   `anchor`, `offsetX`, `offsetY`).
5. Rebuild the atlas (see below) and verify on `/canvas`.

## Rebuilding the atlas

From the repo root:

```bash
npm run build:sprites
```

This runs `scripts/build-sprite-atlas.mjs`, which:

- Rasterizes each SVG with **sharp** at 2× viewBox size (128 tile units → 256px)
- Trims transparent borders (`trimMode` equivalent)
- Shelf-packs frames with **2px padding** into one PNG (max 2048×2048)
- Emits TexturePacker **hash** JSON compatible with PixiJS `Assets.load`

Output:

- `public/spritesheets/components.png`
- `public/spritesheets/components.json`

Frame names must stay `{category}_base` (e.g. `server_base`) so
`Texture.from(frameName)` resolves after `Assets.load`.

### TexturePacker parity (manual workflow)

If you prefer the TexturePacker GUI instead of the build script:

| Setting | Value |
|---------|-------|
| Algorithm | MaxRects |
| Padding | 2px |
| Allow rotation | false |
| Trim mode | Trim |
| Data format | JSON (Hash) |
| Max size | 2048 × 2048 |

Place the exported `components.png` + `components.json` in
`public/spritesheets/` and keep frame names aligned with `spriteFrames.ts`.
