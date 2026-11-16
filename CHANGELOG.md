# Changelog

Every published build. Tagged builds can be restored with `git checkout <tag>`.
Builds v0.2–v0.7 were published as artifact versions before the repo existed and were
not kept as separate files; their changes are all contained in `v0.8.0`.

## v0.9.0 — Lighting & stealth (experimental)
- Real light map: walls and thick smoke cast shadows; ~35% of rooms start dark.
  Fire, campfires, fireflies, electrified water and lightning are light sources.
- Torch toggle (TORCH / `T`): douse it to hide; eyes adjust to see 2–3 tiles in the dark.
- Monsters have a facing direction (arrow on their tile) and a vision cone
  (amber = unaware, red = alerted; toggle in ENGINE → Light & Stealth).
- Detection depends on how lit you are, distance, and whether you're in front, beside or behind.
- Awareness states: unaware `z`, suspicious `?` (heard a noise), alerted `!`.
- Noise: melee, thrown items landing (use them as lures), explosions, lightning,
  and walking on water/grates/ice/snow.
- Sneak attacks: ×2 on an unaware target, ×3 critical from behind while unaware.
- HUD stealth meter (HIDDEN / shadowed / visible), LOOK shows awareness and light level,
  creatures in the dark show as silhouettes.

## v0.8.0 — Campfires, Dawn & Storm scrolls
- Lumber + Dry Grass → BUILD a campfire; feed it lumber; heals 1 HP/turn beside it.
- Campfires spawn periodically (ENGINE → "Campfire every").
- Dawn Scroll reveals and lights the whole floor; Storm Scroll rains and strikes lightning on the current room.

## v0.7.0 — Cooking, sealed bags, aimed throws
- COOK raw food next to fire or a red-hot grate; food in bags never rots; Iron Box is fireproof.
- Throw items straight out of bags; every throw shows an aim screen first.

## v0.6.0 — FACE in LOOK mode turns toward the target.

## v0.5.0 — LOOK mode and auto-EXPLORE.

## v0.4.0 — Wall outlines, minimap, diagonal corridor sliding.

## v0.3.0 — Sandbox mode, weapons/seals/blacksmith/gold, bags with bag-targeted scrolls.

## v0.2.0 — Heat field, poison gas & flash chains, vines, grates, snow, slick ice, gale staff,
fireflies, meat, new monsters, night floors, environment-kill XP.

## v0.1.0 — First prototype.
