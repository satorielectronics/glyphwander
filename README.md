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

## License
GPL-3.0 — see `LICENSE`.
