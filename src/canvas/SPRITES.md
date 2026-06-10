# Canvas sprite rendering

When `USE_SPRITE_COMPONENTS` is `true` in `config/renderMode.ts`, component
bodies render from the tinted spritesheet instead of procedural `Graphics`.

## Runtime flow

1. `CanvasApp.tsx` loads `/spritesheets/components.json` via PixiJS `Assets.load`.
2. If every frame listed in `sprites/spriteFrames.ts` (`EXPECTED_ATLAS_FRAMES`)
   is present, `sprites/atlasState.ts` marks the atlas ready.
3. `ComponentContainer` mounts `sprites/SpriteComponent` when the flag is on,
   the atlas is ready, and the node type has a frame mapping.
4. On load failure or missing frames, the app logs a warning and keeps
   procedural rendering — no hard failure.

Toggle `USE_SPRITE_COMPONENTS = false` to restore procedural cubes exactly.

## File map

| Path | Role |
|------|------|
| `src/assets/sprites/*.svg` | Grayscale SVG sources |
| `scripts/build-sprite-atlas.mjs` | SVG → PNG atlas + JSON |
| `public/spritesheets/components.*` | Shipped atlas |
| `sprites/spriteFrames.ts` | Node type → frame + tint + layout strategy |
| `config/spriteLayout.ts` | Per-frame scale, anchor, tile seat offsets |
| `sprites/SpriteComponent.ts` | Stacking, row clustering, fan-out tween |
| `components/replicaSlots.ts` | Shared `expandedSlotOffset`, `STACK_STEP` |

Replica fan-out state lives in `ComponentContainer` (`expanded` flag) — not in
`CanvasNode`. Labels, badge, status dot, and overlays stay in
`ComponentContainer` for both render paths.

## Updating the atlas

After editing SVGs or adding a frame:

```bash
npm run build:sprites
```

Then reload the dev server (or hard-refresh) so `Assets.load` picks up the
new sheet. Tune `spriteLayout.ts` if a sprite sits too high/low on the tile.

See `src/assets/sprites/README.md` for SVG authoring rules and TexturePacker
settings.

## Brand tints (applied in code, not in SVG)

| Component | Tint |
|-----------|------|
| App server (`compute`) | `#6b9fd4` |
| Redis cache | `#d82f27` |
| PostgreSQL | `#5b9bd5` |
| RabbitMQ | `#f5f5f5` |
| Load balancer | `#5bc8af` |
| Worker | `#9b71d4` |

`client` nodes always use the procedural path (no atlas frame).
