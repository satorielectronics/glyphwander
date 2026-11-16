# Glyphwander

deterministic roguelike with fun emergent behaviors.

A Shiren-the-Wanderer-style roguelike rendered entirely in ASCII glyphs, built on a small
deterministic engine with cellular-automata systems (fire, heat, gas, water, growth).

Open `index.html` in any browser to play — it's a single self-contained file.

## Source layout
- `src/game.js` — the whole engine and UI
- `src/shell.html` — page markup and CSS
- `build.sh` — assembles `index.html` from `src/`

## Rolling back
Every build is a tag. To play or restore an older one:

```sh
git checkout v0.8.0            # look at / play the pre-stealth build
git checkout main              # come back
git revert <commit>            # or undo a feature on main, keeping history
```

## Versions

Every build is a tagged commit. See `CHANGELOG.md` for what each one added.

| Tag | Build |
|---|---|
| `v0.1.0` | First prototype: ASCII renderer, fire on grass, seeded dungeon |
| `v0.8.0` | Everything through campfires and the Dawn/Storm scrolls — **pre-stealth** |
