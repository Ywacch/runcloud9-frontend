# Engine logo attribution

Engine marks load vendored SVGs from `src/svg-canvas/assets/logos/` via
`skins/logos.ts`, then `IsoFaceLogo` stamps them onto each unit’s isometric
**top face** at runtime: diamond shear for box tops, ellipse squash for DB
drums, clipped + light underlay so marks read as painted on (not billboard chips).

**Source:** [svglogos.dev](https://svglogos.dev/) /
[gilbarbara/logos](https://github.com/gilbarbara/logos) (CC0 1.0 Universal).
Brand trademarks remain with their respective owners; do not imply endorsement.

When adding a logo:
1. Drop the `.svg` into `src/svg-canvas/assets/logos/`
2. Wire it in `logos.ts` (prefer `*-icon.svg` for compact face marks)
3. Set `logoId` on the skin in `engineSkins.ts`
4. Record it in the table below

| Engine | File | Status |
|--------|------|--------|
| PostgreSQL | `postgresql.svg` | vendored · top-face |
| MongoDB | `mongodb-icon.svg` | vendored · top-face |
| Memcached | `memcached.svg` | vendored · top-face |
| Kafka | `kafka-icon.svg` | vendored · top-face |
| RabbitMQ | `rabbitmq-icon.svg` | vendored · top-face |
| NATS | `nats-icon.svg` | vendored · top-face |
| App server (generic) | `go.svg` | vendored · top-face |
| Worker (generic) | `gopher.svg` | vendored · top-face |
| Load balancer (generic) | `nginx.svg` | vendored · top-face |
| Redis | — | brand-body; face marks are Cloudcraft-measured SVG paths (`RedisFaceMarks.tsx`), not a logo stamp |

Also present for future skins: `rabbitmq.svg` (wordmark), `redis.svg`,
plus wordmark variants (`mongodb.svg`, `kafka.svg`, `nats.svg`).

## Image-sprite tint

Quiver unit bodies under `src/assets/components/*.svg` are greyscale `<image>`
sprites. Runtime `brandTint` applies a single accent from `brandTint.top` via
SVG `feColorMatrix` (not true top/left/right face separation). Redis uses a
procedural brand-body and does not go through that filter.
