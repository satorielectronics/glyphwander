# Glyphwander

deterministic roguelike with fun emergent behaviors.

A Shiren-the-Wanderer-style roguelike rendered entirely in ASCII glyphs, built on a small
deterministic engine with cellular-automata systems (fire, heat, gas, water, growth).

**Play online:** https://satorielectronics.github.io/glyphwander/ — always the latest commit on `main`.

Or open `index.html` in any browser to play — it's a single self-contained file. Press `?` in game for keyboard controls.

## Source layout
- `src/game.js` — the whole engine and UI
- `src/shell.html` — page markup and CSS
- `build.sh` — assembles `index.html` from `src/`
- `.github/workflows/pages.yml` — rebuilds and deploys the site on every push to `main`

## Rolling back
Every build has its own branch. To play or restore an older one:

```sh
git checkout release/v0.8.0    # look at / play the pre-stealth build (also: pre-stealth)
git checkout main              # come back
git revert <commit>            # or undo a feature on main, keeping history
```

## Versions

Every build has a `release/vX.Y.Z` branch. See `CHANGELOG.md` for what each one added.

| Branch | Build |
|---|---|
| `release/v0.1.0` | First prototype: ASCII renderer, fire on grass, seeded dungeon |
| `release/v0.8.0` | Everything through campfires and the Dawn/Storm scrolls — **pre-stealth** |
| `release/v0.9.0` | Lighting & stealth: torch, vision cones, sneak attacks — **experimental** |
| `release/v0.10.0` | Full keyboard play, item stacks |
| `release/v0.10.1` | Thrown items make enemies turn toward the sound |
| `release/v0.10.2` | L for LOOK, vim movement keys removed |
| `release/v0.11.0` | Trees, ore & smithing, tainted jerky, noise pathing, save/load |
| `release/v0.11.1` | Aimed zaps, zapping from bags, numpad 0 explores |
| `release/v0.11.2` | Choose how far to throw |
| `release/v0.11.3` | Shift+arrows set throw distance |
| `release/v0.11.4` | Explosion smoke fix, Tab for items, M for map |
| `release/v0.11.5` | Left-hand keys: Q look, W torch, D stairs, Q W E A… in item screens |
| `release/v0.12.0` | Console (~) for spawning monsters and items |
| `release/v0.12.1` | Put out and relight campfires |
| `release/v0.13.0` | Number-row item hotkeys (`bind`), numpad separate |
| `release/v0.15.1` | Fewer boulders (trees unchanged) |
| `release/v0.15.0` | Sleeping monsters; Staff of Slumber, Lullaby Scroll, Tranq Darts |
| `release/v0.14.0` | One-way cover (peek past trees), bushes, boulders, smoke jars |
| `release/v0.13.2` | BIND in the item menu; Z X after Q W E A S D |
| `release/v0.13.1` | Dismantle campfires |

## License
GPL-3.0 — see `LICENSE`.
