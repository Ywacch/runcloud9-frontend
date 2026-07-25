# Engine logo attribution

Face badges under `skins/logos.ts` are compact geometric stand-ins for
development. Replace with official SVGs from [svglogos.dev](https://svglogos.dev/)
(or brand press kits) before shipping marketing surfaces.

When vendoring a real logo:
1. Drop the `.svg` into `src/svg-canvas/assets/logos/`
2. Wire it in `logos.ts`
3. Record license / attribution here

| Engine | Intended source | Status |
|--------|-----------------|--------|
| PostgreSQL | svglogos.dev | stand-in |
| MongoDB | svglogos.dev | stand-in |
| Memcached | svglogos.dev | stand-in |
| Kafka | svglogos.dev | stand-in |
| NATS | svglogos.dev | stand-in |
| Redis | brand-body (not a face badge) | measured Cloudcraft paths |
