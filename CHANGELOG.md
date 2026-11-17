# Changelog

Every published build. Builds with a `release/vX.Y.Z` branch can be restored with `git checkout release/vX.Y.Z`.
Builds v0.2–v0.7 were published as artifact versions before the repo existed and were
not kept as separate files; their changes are all contained in `v0.8.0`.

## v0.13.1 — Dismantle campfires
- Campfire and fire-pit menus have a Dismantle option: the spot becomes ash you can walk through.
  You get back 1 lumber for every 60 turns of fuel left (dropped on the ground if your pack is full).
  Kicking apart a lit fire leaves a little smoke and makes noise.

## v0.13.0 — Item hotkeys on the number row
- The numpad and the number row now act separately. The numpad (read by physical key) moves, waits (5) and
  auto-explores (0); with NumLock off, Home/End/PgUp/PgDn/Clear still move. The number row never moves you.
- Bind items to 1–9 and 0: select an item in your pack or a bag and press a number, or use the console:
  `bind 1 fire staff`, `unbind 1`, `unbind all`, `binds`.
- Pressing a bound number uses the item: staffs open zap aim, jars and other throwables open throw aim,
  food and scrolls are eaten or read (pulled from a bag if needed), weapons equip, bags open.
- Binds follow the item kind, so they survive stacks emptying and refilling; they are saved in the browser.
  A hotbar in the HUD shows each bind with its count or charges (dimmed when you have none).

## v0.12.1 — Put out and relight campfires
- Walk into a campfire for a menu: put it out (leaves a dark fire pit that keeps its fuel) or add lumber.
  Walk into a fire pit to relight it or add lumber.
- Rain, storms and frost now put campfires out into relightable pits instead of destroying them;
  nearby flames, heat or a fire staff relight a pit that still has fuel. A doused fire gives no light — useful for sneaking.

## v0.12.0 — Console
- `~` (or `` ` ``) opens a console over the map; also ENGINE → CONSOLE for touch devices.
- spawn <monster|item> [count] places things next to you, preferring the way you face —
  e.g. `spawn goblin 3`, `spawn katana +2 fire ice`, `spawn lumber 20`, `spawn blacksmith`.
- give <item> [count] puts items straight into your pack (stacks split properly; overflow drops).
- gold <n>, heal, god (no damage), reveal, floor <n>, kill (everything in view),
  list monsters|items|weapons, clear, help.
- Forgiving names (`gob`, `fire staff`, `mithril edge`), Tab completion, ↑↓ history.
- Runs where the console was used are marked "console used" on the end screen.

## v0.11.5 — Left-hand keys
- Map: Q = LOOK, W = TORCH, D = STAIRS (L, T and > still work).
- Item screens (pack, bag view, aim screen, split / read / put choosers): options are lettered
  by position — Q W E, A S D, then R F Z V — so your left hand never moves. X = BACK, C = CLOSE.
  Arrows still select items and buttons; Enter still confirms.

## v0.11.4 — Explosion smoke fix, Tab for items, M for map
- Fix: an explosion in an already smoky fire could push the smoke past the see-through limit,
  hiding the area behind it for a turn (and blocking the fire's light). A blast now adds a
  smaller puff that can't do that on its own, fire glows through smoke, smoke near flames is
  lit warm instead of drawn as dark holes, and smoke dims your view less where fire lights it.
- Tab opens ITEMS (Tab again closes the pack or a bag view; I still works).
- M toggles the full map (Esc also closes it). In the sandbox the brush moved from M to B.

## v0.11.3 — Shift+arrows set throw distance
- On the throw aim screen, Shift+← / Shift+→ (and Shift+numpad 4 / 6) shorten or lengthen the throw.
  Works with NumLock on, where the browser reports Shift+numpad 4/6 as plain arrows.

## v0.11.2 — Choose how far to throw
- The throw aim screen has a Distance control (1–10, − / + buttons or keys, MAX). The map line,
  the × landing marker and the description follow it, and the item lands exactly there unless
  something stops it first. Picking a quick-aim target stretches the throw to reach it.
  The distance is remembered between throws.

## v0.11.1 — Aimed zaps, zapping from bags, numpad 0 explores
- Zapping a staff now opens the aim screen first, like throwing: pick a direction, see the real
  path (12 tiles; gale passes through creatures) and a preview of the effect — who it hits,
  how many tiles it ignites or freezes, and a warning when lightning will touch water or metal.
- Staffs can be zapped straight from inside a bag (ZAP / Z in the bag view).
- Quick-aim targets are numbered on screen; 1–9 picks them.
- Numpad 0 starts or stops auto-explore.

## v0.11.0 — Trees, ore & smithing, tainted jerky, smarter investigation, save/load
- Trees: block movement and sight (cover for sneaking), burn for a long time, attract lightning.
  Walk into one to chop (3 swings, noisy) for 2–4 lumber and sometimes dry grass.
- Ore veins glint in walls facing open ground: iron on every floor, mithril from B3.
  Mine them by walking into them with a pickaxe (blacksmith sells one for $40).
- Blacksmith smelts 2 ore → 1 bar (iron $5, mithril $15) and trades bars for gear:
  Greatsword (power 7), Mithril Edge (power 9), Temper +2, Rune-forge (every seal),
  Satchel, Overcharge staffs. Bars and ore stack to 10 and count from bags too.
- Cooking rotten meat now makes Tainted Jerky: +30 fullness but paralyzes the eater for
  5 turns; thrown at an enemy it paralyzes it for 6 (sneak attacks crit on paralyzed foes).
- Enemies that hear a noise now path to it around walls and trees, then search the area.
  Chopping, mining and digging make noise.
- Save / load: SAVE button or K. Three slots plus an autosave on every new floor (browser
  storage), and export/import codes to move a run between devices. Loading restores the
  exact state — the same moves afterwards give the same result.

## v0.10.2 — Keyboard: L for LOOK, vim movement removed
- LOOK is now on `L` (`V` still works).
- Removed the vim movement keys (h j k l y u b n) everywhere, including menus, so those
  letters are free for actions. Move with the arrow keys or the numpad (7 9 1 3 diagonals).

## v0.10.1 — Thrown items draw attention
- Every creature that hears a thrown item land turns to face the spot. Unaware ones investigate;
  alerted ones glance over, and go to check it if they've lost sight of you.
- Landing sound carries 5 tiles by default (heavy items 6, light ones 3); walls muffle it to half.
  Adjustable in ENGINE → Light & Stealth → Throw noise.
- A creature hit by a thrown item turns toward you. Creatures no longer about-face after
  investigating a sound they couldn't reach.

## v0.10.0 — Full keyboard play, item stacks
- Every menu works from the keyboard: ↑↓ select items, ←→ pick an action, Enter does it,
  Esc goes back; letter hotkeys on every action (hints show on keyboard devices).
- Aim screen: direction keys turn you, 1–9 jumps to a visible enemy, Enter throws.
- Engine panel: ↑↓ between controls, ←→ change sliders and choices.
- `?` opens a keyboard reference. Sandbox: `G` paints the tile you face, `,` opens its menu.
- Item stacks: Lumber and Dry Grass (20), Seeds and Herbs (10) share one slot.
  Stacks merge on pickup, in bags and on the floor; SPLIT (1, 5, 10 or half) and COMBINE.
  Throwing, building and eating use one from the stack; a lumber stack in fire makes a bigger campfire.
- Fix: a monster created in view (spawned or painted in the sandbox) no longer crashes the vision cones.

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
