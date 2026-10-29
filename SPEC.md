# Eden's Island (האי של עדן) — Consolidated Spec (single source of truth)

## Rollback (2026-10-16, owner request)
The owner reported a white 3D board on Android starting with the "Phase 3 UX" version (963602f).
On request, the code was rolled back to the version right before it — "Physics dice" (997e1db) —
by reverting 963602f, d532305, c2ae6b8 and 445cc0d. Only diagnostics were re-added on top
(client `diag.ts`, server GET /diag, log-only WebGL listeners in Board3D: GPU type, context
lost/restored; plus the dev tool `scripts/latency.ts`). Everything described below for those
four versions (build tray, tips, volume slider, chance %, the rename to "האי של עדן", percentage
removal, renderer changes, 2D fallback, early server ack) is currently NOT in the code; the
sections are kept as history so they can be re-applied selectively after the owner's test.

## Real root cause of the white board (2026-10-16, after the rollback test)
The owner's game on the rollback still lost the 3D context ~8 times in 13 minutes (one loss froze
the page for 22 s, which dropped the socket → "Reconnecting…" / "game was out of date").
Cause: `useState(getBoardMode())` in GameScreen and `webglAvailable()` in the settings menu ran on
EVERY render, and each call created a new WebGL context. Phones allow only a few live contexts, so
Chrome killed the oldest one — the board's. Renders spike on rolls (dice overlay, highlights, card
flights), turns, and the volume slider, matching what the owner saw. The 3D dice physics itself
takes ~3 ms and is not the cause. Fixes:
- `boardMode.ts` probes WebGL once per page load and releases the probe context; lazy useState.
- Board3D: redraw on `webglcontextrestored` and on returning to the page; shared marker materials;
  `clear()` disposes old materials/canvas textures; `dispose()` calls `forceContextLoss()`.
- Dice: face textures assigned at creation (no shader rebuild on a roll).
- Sync: server replies to actions before the DB save (re-applied from d532305, `RoomManager.flush`);
  client re-requests state (`room:resume`) after "out of date" / no-response; `busy` reset in
  `finally`; bot request ids include the attempt number (a retry no longer hits the cached rejection).
- Deploys: index.html is served `no-cache`, missing `/assets/*` return 404 (not index.html), and a
  failed 3D chunk load reloads the page once instead of leaving a blank screen.
Re-applied on owner request: the name "האי של עדן" / "Eden's Island" and the effects volume slider.
Still NOT re-applied: build tray, tips, light mobile renderer, 2D fallback.

Slowdown over a long game (2026-10-16): no leaks (heap, DOM, payload ~13 KB and bot time stay flat),
but the 3D board drew 60 full frames/s (~215 draw calls + shadow pass) whenever lands glowed or
spots pulsed, heating the phone until it throttled. Now: glow/pulse tweens are `ambient` (~30 fps,
no shadow pass; shadows redraw only on real motion via `shadowMap.autoUpdate = false`), and the
invisible tap areas sit on a raycast-only layer (not drawn). Idle = 0 frames.


Game name changed from "Hex Islands" to "האי של עדן" / "Eden's Island" (owner, 2026-10-16).

Merges `prd-catan.md` (original) + `update.md` (binding override wherever the
original limits the game to 2 players) + decisions agreed with the owner.
Read this file instead of the originals; consult them only for fine detail.

## Product
- App icon (owner-approved artwork, 2026-10-28): sunset behind a green hilltop village,
  painted wheat fields, no text or border. PNG master: `public/eden-island-icon-1024.png`;
  192/512 PNGs for PWA (including maskable), 180 PNG for Apple home screens, multi-size
  `favicon.ico` for browser tabs. Replaces the hexagon SVG; service-worker cache v3.
  Install splash background is the icon's sky color `#e2583d`.
- Menu screens (2026-10-28): the icon artwork (`public/art/menu-bg.webp`) is a fixed
  backdrop behind every `.screen`; the home form sits on a warm smoked-glass `.card.panel`
  with gold selected states. Mobile portrait first; the old hex SVG logo is gone.
- Private online board game inspired by base CATAN (no expansions). Original
  name/art/sounds — no official logos/assets.
- Owner plays with girlfriend/friends on separate phones via an invite link.
- Mobile-first PWA. **UI language: Hebrew (RTL) by default**, English selectable
  (Home screen and in-game settings). All UI strings, log templates and error
  translations live in `packages/client/src/i18n.ts`.
- Visual style (owner request, 2026-10-15): look and feel of the official 6th-edition
  rulebook — turquoise sea, sandy beach, painted terrain, cream number discs with red
  6/8, wooden piers with parchment harbor tags, cream-framed resource cards, coloured
  dev-card headers, block-style pieces in red/blue/white/orange. No official assets/logos.
- Design v2 "physical table" (2026-10-16, frontend-design skill): painted raster art is
  generated from code by `packages/client/art-src/generate.py` (numpy + Pillow + SciPy)
  into `public/art/*.webp` — terrain tiles (2 variants each), sea frame with beach,
  resource cards, dev-card illustrations, card backs, wood and parchment textures.
  Re-run the script after changing the art code. Board pieces, number discs, harbors,
  dice and robber stay SVG (crisp, cheap). No SVG filters on the board (phone perf).
  Fonts: Frank Ruhl Libre (headings, numbers, card titles) + Rubik (UI text).
  Animations: cards fly from producing lands to hands, pieces drop in, dice tumble,
  robber slides; all disabled under prefers-reduced-motion.
- Phase 1 "juice" (2026-10-16): `packages/client/src/game/fx.tsx` turns each new log event
  (engine `logSeq` / per-entry `seq`) into an animation + sound: steals (face-up only for
  thief/victim), player and bank trades, discards, dev card buy (deck → hand) and play
  (big card reveal), Monopoly/Invention card flows, Longest Road / Largest Army award
  banners, "Your turn!" banner, dust puffs on new pieces. Sounds are synthesized in
  `sound.ts` (dice on wood, wooden clacks, card swishes, coins, bells); vibration
  patterns via navigator.vibrate (Android) with toggles in ☰ settings.
- Phase 2 3D board (2026-10-16): `packages/client/src/game/Board3D.tsx` (three.js, lazy-loaded
  chunk ~140 KB gzip). Cardboard hex tiles with thickness (painted textures on top), sea frame
  plate on a wooden table, wooden 3D pieces, pawn robber, real sun shadows, tilted camera
  (drag = rotate, pinch = zoom, double tap = reset), raycast tap picking with gold pulsing
  markers, drop/slide animations, on-demand rendering. Same props/BoardApi as the 2D board;
  ☰ menu toggles 3D/2D (saved per device; 2D automatically when WebGL is missing).
- Phase 2b physics dice (2026-10-16): `packages/client/src/game/dice3d.ts` (cannon-es). The
  server's result is authoritative; the client simulates a throw headlessly (re-throwing until
  both dice lie flat), records it, then paints the die faces so the server's values land on
  top (opposite faces still sum to 7) and replays the motion with impact sounds from real
  collisions. 2D board / reduced motion keep the flat dice overlay. Test: client/test/dice.test.ts.
- Rules check vs the official rulebook (2026-10-16): starting resources only for the 2nd settlement,
  dev cards not playable on the turn bought (VP cards excepted), one dev card per turn, playable
  before rolling, discard half (rounded down) above 7, bank shortage rule — all match the engine.
- House rule (owner, 2026-10-16): optional "resources for both settlements" toggle on the create
  screen, off by default (room config `startResBoth` → engine `GameConfig.startResBothSettlements`),
  shown as a tag in the lobby, with a short explanation of what a house rule is.
- House rule 2 (owner, 2026-10-16): "play development cards right away" (`devSameTurn` →
  `GameConfig.devCardsSameTurn`, shared check `devCardReady` in rulesets.ts used by engine, bot and
  UI); still one development card per turn.
- Blue-screen freeze (2026-10-16): the 2D pinch zoom read `gesture.current` inside a deferred state
  updater; when the fingers lifted first it was null → React crashed and unmounted the app (blue
  background). Fixed, and `Recover.tsx` now wraps the app: a crash is reported (`crash` in /diag)
  and the screen is redrawn automatically; only repeated crashes ask for a reload.
- Owner decision (2026-10-16): NO probability percentages anywhere (board, inspect label, tips).
- Mobile robustness (2026-10-16): 3D renderer uses preserveDrawingBuffer, a short redraw burst
  after every change plus a 1 s heartbeat, redraws on visibility/focus/orientation, and rebuilds
  the scene after a lost GPU context (fix for the board turning white on Android).
- Root cause of the white board (diagnostics from the owner's Android, Mali-G715, DPR 3): the
  GPU dropped the WebGL context every few seconds (16 times in 4 minutes). Fix: phones get a light
  renderer — no MSAA, pixel ratio ≤1.5, Lambert/Phong instead of PBR materials, 512 PCF shadow
  map re-rendered only when pieces/robber/dice move, no fog, anisotropy 1, ~30 fps cap for
  ambient pulses, no preserveDrawingBuffer. If the context is still lost twice within 2 minutes,
  the game switches to the 2D board for the session with a message (3D can be re-enabled).
- 3D self-recovery (2026-10-16): the render loop polls gl.isContextLost() every second and
  rebuilds a brand-new canvas if the context is not restored within 600 ms; on page wake / window
  blur / visual-viewport resize it redraws.
- Diagnostics: clients report technical events (`client/src/diag.ts`: GPU type, context lost /
  rebuilt, render errors, JS errors, visibility, volume changes) via socket `client:diag`;
  read the last 300 at GET /diag (no personal data; in-memory, cleared on restart).
- Latency: the server acknowledges actions before the database save completes (saves stay
  ordered per room; `RoomManager.flush` for tests). Measure with `scripts/latency.ts <url>`.
- Phase 3 UX (2026-10-16): build tray (`BuildTray` in Panels.tsx) replaces the Build button —
  affordable items glow gold, tapping a blocked item explains why, dev card buys via the confirm
  bar; first-time contextual tips (`game/tips.tsx`, once per device,
  resettable); effects volume slider; settings toggle for tips (`prefs.ts`).
- Design roadmap (remaining): (tilted camera, extruded tiles with
  normal maps, 3D pieces, physics dice, 2D fallback); phase 3 = UX (tutorial, build tray,
  probability hints, landscape layout, volume settings); phase 4 = ambience (waves,
  birds, victory camera orbit, emotes).

## Participants (update.md is binding)
- 2–4 total participants, any mix of humans and bots: `2 <= humans + bots <= 4`, bots ≤ 3.
- All 9 combos supported (1H+1-3B, 2H+0-2B, 3H+0-1B, 4H).
- Default config: 2 humans + 2 Medium bots, target 10 VP. Each bot has its own level (`botDifficulties`), chosen per bot on the Home screen and by the host in the lobby.
- Config fixed once the match starts. Never silently add bots.
- 3–4 participants → classic base rules. 2 participants → "simplified two-player"
  ruleset (same rules, A→B→B→A setup, no neutral players), modular in
  `engine/src/rulesets.ts`.

## Mods / expansions — infrastructure design (owner-approved 2026-10-28; stage 0 built on branch `mods-stage0`)
Goal: a solid base for every official CATAN expansion, added one at a time later. The owner
supplies the official rules (catan.com) for each expansion before it is built; nothing is
implemented from memory. Any interpretation is written here and confirmed with the owner.

Decisions
- One mod per game (no combining expansions). Combinations only if the owner asks later.
- 5–6 players is not a mod and not a toggle: choosing 5 or 6 participants switches the chosen
  mod to its 5–6 rules. Each mod declares whether it supports 5–6; base gets it first.
- Approach "mod = package": each mod is one self-describing definition the engine consults
  instead of hard-coded constants (rejected: one engine copy per expansion; `if expansion`
  checks scattered through the code).

Player flow
- Home (screen 1): name, humans, bots + levels; up to 6 participants (bots ≤ 5). The
  "Create game" button becomes "Choose mod →".
- Mod screen (screen 2, new): large illustrated card per mod. "Base game" is active; future
  expansions show as greyed "Coming soon" cards. With 5–6 participants each card shows a
  "5–6 players" tag; a mod without 5–6 support is greyed with an explanation. The chosen
  mod's settings appear under it (victory target, board type, house rules — moved here from
  Home). Buttons: back, "Create game".
- Lobby shows the mod name (+ 5–6 tag). The host may change settings but not the mod; a
  different mod means a new game.
- Games saved before this change load as Base game, version 1.

Engine architecture
- `engine/src/mods/<id>.ts`, one per mod: id, name/art key, rules version, participant range
  (normal and 5–6), board generator, bank size, dev deck, costs, piece limits, player colours
  (5–6 adds green and brown), settings shown on screen 2, and hooks for extra actions/phases.
  A single registry (`mods/index.ts`) is read by server (validation) and client (cards).
- The board graph moves into the game state (today `GRAPH` in geometry.ts is one global
  map used by rules, queries, bots, 2D and 3D boards). Everything reads the game's own graph.
- `GameState` records `mod` and `modVersion`; a game keeps the rules version it started with.
- Client receiving an unknown mod id asks to reload the page instead of drawing a broken board.

Build order
- Stage 0 — DONE 2026-10-28 (branch `mods-stage0`, not yet merged/deployed): the mod and its rules
  version live in `GameState.config.mod` / `config.modVersion`, the island shape in
  `board.layout`; server `migrate()` fills them for older saves. Guarded by
  `engine/test/regression.test.ts` (seeded full games recorded before the refactor; never update
  that snapshot to make a change pass).
  Original plan: move the base game into the mod structure with zero visible change. All existing
  tests and seeded bot simulations must produce identical results to before.
- Stage 1 — DONE 2026-10-28 (branch `mods-stage0`): `client/src/screens/ModPicker.tsx` is home step 2
  (a history entry, so the phone back button returns to step 1). Menu list `CATALOG` there: ids in the
  engine's `MODS` are playable, the rest show greyed as "Coming soon" (Seafarers, Cities & Knights,
  Traders & Barbarians, Explorers & Pirates). Card art = three painted hex tiles. Victory target, board
  and house rules moved from step 1 to step 2. Step 1's participant limit = largest `maxPlayers` of any
  mod (4 today). Lobby shows "Mod: <name>" and caps players at the room mod's `maxPlayers`. A client
  that receives an unknown mod id shows "new version — reload" instead of the game.
- Mod box art (owner decision, 2026-10-28): Base game and Seafarers show as 3D game boxes using box
  images the owner supplied (`public/art/mod-base.webp`, `mod-seafarers.webp`, 246 px). This is a
  deliberate exception to "no official assets" for the mod screen only. Pure CSS 3D (lid + side +
  bottom faces); never put `mix-blend-mode`/`filter` on `.box-3d` itself — it flattens the 3D.
- Stage 2: 5–6 players for the base game, from official rules the owner sends (larger board,
  bank, deck, extra colours, the official extra-build rule).
  Engine + server DONE 2026-10-29 (plan `docs/superpowers/plans/2026-10-29-base-5-6-players.md`,
  rules from the owner's 2025 5–6 rulebook): `BASE_MOD.large` (layout `classic56`, 30 hexes, 2
  deserts, 28 numbers, 11 harbors with gaps 3,4,3,4,…,3 on the 38-edge coast, bank 24, deck 34,
  + green `#3d9a3f` / purple `#7d4fb8`); `modFor({ config, players })` picks it for >4 players;
  `modPlayerRange` = 2–6. Paired players: `GameState.paired = { first }` while Player 2 (third
  after Player 1 in turn order) has a build/bank-trade/one-dev-card phase with no roll and no
  player trades (engine error "Player 2 may not trade with other players"); the phase counts as
  its own `turn` (so cards bought in it are playable on the owner's next turn, and vice versa);
  log key `pairedTurn`. Interpretations: robber on the first desert; turn order from the
  opening roll; normal snake setup; 5 players use 5 colours (no neutral settlements); P2 may
  also win at the start of their phase (e.g. after gaining Longest Road during P1's turn).
  Beginner 5–6 harbors: coast index 0 onward, generic, wool, generic, ore, generic, grain,
  brick, generic, lumber, generic, wool.
  Client DONE 2026-10-29: boards size themselves from `graphBounds` (`boardFrame()` in Board.tsx:
  2D viewBox, 3D frame plate + camera fit) with sea art per layout (`sea-56.webp`, made by
  `art-src/extras.py sea-56`); menus offer 2–6 participants and a "5–6 players" tag; chips for
  5–6 players sit in a 3×2 grid; during Player 2's phase everyone sees "Player 2: X — build and
  trade with the bank only" and the trade sheet is bank-only. Checked live on localhost: a 6-player
  game (1 human + 5 bots) ran 60 turns / 30 paired phases with a rule observer — Player 2 always
  the 3rd after Player 1, no player trades in P2 phases, dice passed to the next player each time,
  supply always 120 cards, 30 hexes / 11 harbors, P2 built and bank-traded.
- Then one expansion at a time, each with its own spec section, tests, 100-game bot run,
  and owner check on localhost.

Known risks and how they are handled
- Breaking the base game → stage 0 identical-seed regression check.
- 6 players on a phone (player chips, trade panel, log) → redesigned chip row, checked at
  phone size before owner review.
- Bigger 3D board on phones → measure frame rate on the 5–6 board; keep "no drawing when
  nothing moves".
- Bots assume the classic board → bots read the game's graph; each mod ships a bot
  self-play test (100 games finish without getting stuck).
- Lowering the player count below already-joined humans → same refusal as today.
- Old cached client vs new mod → unknown-mod reload prompt (see above).
- Unclear expansion rules → only from owner-supplied official material; ask, then record here.

Stage 2 (5–6 players) notes from the stage-0 review — still hard-wired to the base game:
`rulesetFor(playerCount)` (setup order) is not mod-aware; `DISCARD_THRESHOLD`, award minimums,
`TERRAIN_RESOURCE` and the 4:1 / 3:1 trade rates are global; harbor gaps assume the 30-edge
classic coast; Home `fitConfig` clamps to 4 players; 2D `VIEW` size, sea art and the 3D camera
fit/sea plane are sized for the 19-hex island (compute from graph bounds); Board3D's board effect
should also depend on `board.layout`.

## Seafarers (owner decisions 2026-10-29)
Roadmap and rules summary: `docs/superpowers/plans/2026-10-29-seafarers.md` (stages S1–S7).
2 participants play the official 3-player map; 5–6 use the Seafarers 5–6 maps with paired turns.

Stage S1 engine + server DONE 2026-10-29:
- Mod `seafarers` (`SEAFARERS_MOD`, 2–4 participants for now; 5–6 is stage S7). Ships cost
  lumber + wool, 15 per player (`pieceLimits.ships`, `costs.ship`; their presence = `hasShips(mod)`
  turns on ships, pirate and gold). Scenarios in `mod.scenarios` (`ScenarioDef`: victory target,
  maps per size, start regions, home regions, region bonus); `config.scenario` (default
  `newShores`), `scenarioFor(state)`. 2–3 participants → 3-player map, 4 → 4-player map.
- Maps (`mods/seafarers/maps.ts`, `ScenarioMap`) become layouts `sf-<scenario>-<3|4>p`
  (`registerLayout`), hexes in map order then the frame-printed sea spaces (`frameSea`); ports
  from hex sides (`hexSideEdge`); `board.pirateHex`, `board.startRegions`, `hex.region`.
- Terrain gains `sea` and `gold`. A vertex is buildable only if it touches land; roads need a
  land side; ships need a sea side (outside the map counts as sea); a road and a ship never share
  an edge. Heading for New Shores: start on `main`, +2 VP tokens (`player.vpTokens`, public) for
  a player's first settlement on each other region (`player.bonusRegions`), win at 14 (the room's
  target is ignored).
- Actions: `buildShip {edge}`, `moveShip {from, to}`, `movePirate {hex}` (ROBBER_MOVE),
  `chooseGold {resources}` (phase `GOLD_CHOICE`, `pendingGold`, `goldReturnPhase`),
  `placeSetupRoad {edge, ship: true}`, `placeFreeRoad {edge, ship: true}`. State: `ships`,
  `shipMoved`, `newShips`, `player.shipsBuilt`. Log keys: builtShip, movedShip, placedFreeShip,
  pirateMoved, goldOwed, goldChosen, regionBonus. Server: `RoomConfig.scenario` validated
  ("Unknown scenario"), fixed after creation ("The scenario cannot be changed"); `chooseGold` is
  parallel-safe like discards; `migrate()` defaults the ship fields of Seafarers saves.

Stage S1 client DONE 2026-10-29 (local check only, not deployed):
- Mod screen: the Seafarers box is playable (2–4); a scenario list under the boxes shows every rulebook
  scenario (playable = ids in `SEAFARERS_MOD.scenarios`, the rest greyed "coming soon") with a goal line
  and "first to N points"; for Seafarers the target/board controls are replaced by the scenario's
  target. `RoomConfig.scenario` is sent; the lobby shows "Scenario: <name>" and the scenario target.
- Boards: `boardFrame()` returns `sea: null` for `sf-` layouts → no painted beach, plain open sea
  (`OPEN_SEA` #2394b0, the painted sea's rim colour) under the map's own sea tiles (2D rect, 3D frame
  plate hidden). Ships: 2D hull along the edge + upright sail; 3D one shared merged geometry (hull in
  the player colour, shared sail material), dropping in like roads. Pirate: dark ship on
  `board.pirateHex`, animated like the robber. Island bonus: a "+2" laurel coin under the player's
  first building in each bonus region (the engine stores regions, not spots).
- Play: build tray "Ship" and "Move ship" (pick a highlighted movable ship, then its target);
  setup / Road Building edges are road ∪ ship; an edge that is both asks "Road or ship?" (two
  buttons); robber phase highlights land (robber) and sea (pirate, dark/yellow ring) hexes; gold
  choice sheet like the discard sheet, limited by the bank; ⛵ ship count on player chips; Knight and
  Road Building card texts mention the pirate/ships. fx: ship clack + dust, pirate sound, gold cards
  fly from the bank, small "+2 points: new island!" banner.
- `server/scripts/autoplay.ts` drives Seafarers seats with the medium bot (keeps bot memory).

Interpretations (Seafarers S1):
- Pirate "to the frame": there is no separate frame spot — the player moves the pirate to any
  other sea hex; choosing one without ships = nobody to rob. Frame-printed sea spaces (the pirate's
  start) are ordinary sea hexes of the board.
- Robber stays on land; pirate on sea. Pirate steal candidates = players (not you, with cards)
  with a ship on any edge of that sea hex; one candidate is robbed automatically.
- Gold: normal production is paid first (base shortage rules), then each owed player chooses
  (simultaneously, any order). With a short bank a player must take min(owed, cards left in the
  bank) and only what the bank has; once the bank is empty the remaining choices are skipped.
  Gold choices are added to `lastRoll.gains`. Starting resources: 1 of choice per gold hex at the
  second settlement (or both with the house rule), chosen before that settlement's road/ship.
- Ships connect only to the owner's ships or buildings, never through an opponent's building;
  no ship may be placed on, or moved to/from, any edge of the pirate's hex (this also applies to
  the setup ship and Road Building ships).
- Moving: once per turn in the Action phase (after rolling), not a ship built this turn (incl.
  Road Building ships), needs an open end (an end vertex with neither another own ship nor an own
  building), and not on a line of own ships linking two own buildings (opponent buildings on the
  line ignored). The ship is lifted first, so it cannot connect through its own old spot.
- Longest Route counts roads and ships; they join only at a vertex holding the player's own
  building. Base-game results are unchanged.
- Road Building gives 2 free pieces, each a road or a ship (`placeFreeRoad` with `ship: true`);
  it ends early when neither a road nor a ship can be placed.
- Region bonus uses the region of the land hexes at the vertex; a bonus is per player per region
  (others settling first does not matter). Settlements in `homeRegions` (`main`) never earn one.
- Fixed setup only (variable setup is a later stage); `boardType` is ignored for Seafarers.
- Settlement error in Seafarers: "Settlement must connect to one of your roads or ships".

Scenarios wired (2026-10-29): `newShores` (1), `fourIslands` (2: `homeRegions: 'starting'` — the
regions of a player's starting settlements are their home islands, stored as `PlayerState.homeRegions`;
13 VP), `throughDesert` (4: start on 'main'; the land strip beyond the desert ('strip') and the isles give
+2 VP; deserts belong to 'main'; 14 VP). Map notes from transcription: Four Islands 4p uses the
3-player-size frame (35 tiles); pirate starts printed on the frame are `frameSea` spaces (Through the
Desert's touches only land).

The Fog Islands (3, wired 2026-10-29; 12 VP; starting settlements anywhere). Maps on the 4-player
frame for 3p and 4p (`fogMaps.ts`); empty spaces are terrain `fog` (neither land nor sea: no
production, no robber/pirate, no settlement on a spot touching only fog + sea, roads need a real land
side, ships a real sea side or the frame). `GameState.fogStack` holds the face-down hexes and discs
(unordered, hidden from views; views get `fogLeft`). Interpretations:
- Every `fog` space touching either end of a newly placed road or ship is discovered — built, free
  (Road Building), setup, or moved ships alike — one random hex each, in hex-id order.
- Land gets a random disc and pays 1 resource of its type if the bank has it; sea pays nothing; a gold
  field pays 1 resource of choice (GOLD_CHOICE, then back to the same phase; `goldDiscovered` keeps
  it out of the dice-roll gains). Desert would get no disc (none in the stack).
- Bots value fog spaces (roads/ships toward them, a spare ship into the fog, coastal spots) — a
  scenario-specific nudge; the general bot rework is the side task below.

The Forgotten Tribe (5) and Cloth for Catan (6), wired 2026-10-29 (`tribeClothMaps.ts`; one map for
3 and 4 players each, as in the rulebook):
- `Board.numberedOnly`: settlements only at spots touching a numbered hex, the robber only on numbered
  hexes. Cloth uses it too: its small-island hexes carry no disc, which gives exactly "no settlements
  or robber on the small islands".
- Tribe: `Board.edgeItems` (8 VP, 4 dev, 6 ports; port types shuffled, dev cards = the top 4 of the
  deck, kept in hidden `GameState.edgeDevs`). Any ship placed or moved onto the edge takes it (also
  Road Building ships). Dev card counts as bought this turn. A port goes to `heldPorts`; `placePort`
  puts it on a coastal edge (land + sea/frame) at one of your buildings with no port touching either
  end. While a port can be placed you may not end your turn (rule: "if possible, place"); otherwise it
  waits until you have a spot.
- Cloth: villages are corners (top/bottom) of the 4 one-hex isles, 5 cloth each, general supply 10.
  A route = your roads/ships from one of your buildings to the village corner, not through an
  opponent's building (`routeReaches`). Opening trade takes 1 cloth (if any). A roll of the village
  number gives each partner 1 cloth (village first, then the general supply; an empty village
  gives nothing). 2 cloth = 1 public VP. Ships in a building–village line can't move. Pirate only
  after your first village; its steal may take cloth (thief always chooses, `stealCloth`). 3 starting
  settlements (`setupRounds`, third round in turn order, resources from the third only). No Longest
  Route. End: 14 VP on your turn, or at the end of a turn with 5+ empty villages → most VP, then most
  cloth, then lowest seat.

The Pirate Islands (7) and The Wonders of Catan (8), wired 2026-10-29 (`pirateWonderMaps.ts`, one map for
3 and 4 players each; local check only, not deployed). Pirate islands are regions `isle1-5`; Wonders has
`main` (deserts included) + `isle1-2`.
- Pirate Islands: `Board.pirateFleet` (14 sea hexes, sails clockwise), `Board.fortresses` (per seat: printed
  settlement `start` + `startShip`, `beachhead`, fortress `vertex`, `lairs` 3), `Board.noRobber`,
  `Board.buildRegions: ['main']`, `GameState.warships`. Slots red/blue/white/orange; 2–3 participants use
  red, blue, orange (seat i → i-th slot). Deck: 3p 20 cards (no VP cards), 4p VP cards become Knights (19).
  No Longest Route / Largest Army. Win: fortress captured and 10 VP on your turn.
- Interpretations (Pirate Islands): the single line of ships starts at the printed ship; every ship (built,
  Road Building) must extend its end one step along a shortest path (BFS over free sea edges, avoiding
  opponents' buildings) to the beachhead, then to the fortress; no other ships ("other routes around the main
  island" = roads); no setup ships; ships never move. Settlements only on the main island or the own
  beachhead; roads only next to main-island land. The fortress settlement is one of the player's 5 pieces
  (reserved until captured). Fleet: after every roll it sails the lower die along the path and attacks each
  player with a building on a corner of that hex (before production / the 7); "1 card + 1 per city" counts all
  of that player's cities; a won attack gives 1 resource of choice via GOLD_CHOICE (on a 7 the choice comes
  first, then the discards — `goldReturnPhase: 'ROLLED_SEVEN'`). A 7: discards, then the roller picks any
  player with cards (always ROBBER_STEAL, no robber, the pirate is never moved by hand). Knight = turn the
  normal ship nearest the start into a warship (not counted as a knight played). End of turn (on `endTurn`)
  with a line reaching the fortress: die vs warships in the line; win removes a lair (third captures it,
  becomes the player's settlement); lose removes the 2 ships nearest the fortress, tie 1. All fortresses
  captured → pirate removed. Log keys: pirateFleet, fleetRaid, fleetRepelled, fleetTie, warship,
  fortressAttack, fortressHit, fortressCaptured, fortressRepelled, pirateGone.
- Wonders: `Board.wonderSpots` (5 wall, 2 bridge, 4 "X"); starting settlements on `main`, never on those
  spots; +1 VP first settlement on each small island; no pirate (`map.pirate` optional). Tiles (rulebook p. 1,
  cost per level): Grand Castle brick+grain+3 ore (1 city & 6 VP), Grand Monument 3 grain+2 ore (city at a port
  & route 5+ = longest route ≥ 5), Great Bridge 3 lumber+wool+grain (building at a bridge marker), Grand
  Theater brick+lumber+3 wool (2 cities), Great Wall 3 brick+lumber+grain (building at a wall marker).
  Actions `claimWonder {wonder}` (free, one per player, requirement checked when claiming) and `buildWonder`
  (next level, 4 levels). Win on your turn: level 4, or 10+ VP and a strictly higher level (≥1) than everyone
  else; 10 VP alone does not win. Log keys claimedWonder, builtWonder (param `w`).
- Client: 2D/3D fortress (dark keep + lairs badge), beachhead ring, warships (2D gun ports + pennant, 3D ship
  on its side), fleet course (dotted loop with arrows), wall/bridge/X markers, no robber; chips show 🛡
  warships, 🏴 lairs, 🏛 wonder level; Build sheet lists the wonders (claim / build level, reason in Hebrew);
  Knight text for the Pirate Islands; harbors are now drawn above the tiles and point away from the land hex
  (fixes ports hidden under inner sea tiles in every Seafarers map).
- Bots: sail the line, hold the ship that reaches the fortress until they have 3/4/5 warships (easy/medium/
  hard), buy dev cards for Knights; claim a wonder as soon as one is open and build levels. Measured over 24
  seeded bot games: every game ends (Pirate ~90–105 turns, fortress + 10 VP; Wonders ~60–85 turns, mostly a
  finished Grand Theater/Castle), zero rejected actions.

New World (9) and the variable setup option, wired 2026-10-29 (`mods/seafarers/random.ts`; local check only):
- New World (p. 20): frame of 42 spaces (rows 5-6-7-6-7-6-5, `NEW_WORLD_FRAME`, one for 3 and 4 players) dealt
  at random in `createGame` (`ScenarioDef.newWorld`): 19 sea, 4 hills, 5 forest, 5 pasture, 5 fields, 4 mountains;
  23 discs with no two red side by side (redealt — same result as the rulebook's swap); 10 ports (5 × 2:1, one per
  resource, 5 × 3:1) placed one by one on random coastal edges (land + sea/frame), never sharing a corner
  (interpretation of "players take turns placing a random port"). Islands = connected land, regions isle1..
  in hex order. Robber and pirate start on the frame: `robberHex` / `pirateHex` = -1 (no hex blocked, no
  ship-placement limit) until the first 7 / Knight. Home islands = islands of the starting settlements
  (`homeRegions: 'starting'`), +1 VP for the first settlement on each other island, 12 VP wins.
- Variable setup: room/engine option `variableSetup` (mod screen checkbox "סידור משתנה", only for scenarios
  with `ScenarioDef.variable`; lobby tag). Land hexes + their discs are redealt within groups of regions, fixed
  terrains stay, port types are shuffled over the printed port spots, sea and regions stay. Per scenario:
  New Shores — main and small islands apart, no adjacent red, robber on the 12 (3p) / desert (4p); Four
  Islands — all land together, no 2/3/11/12 on forest/pasture, robber on the 12; Fog Islands — all face-up land
  together, red may touch, robber on the 12; Through the Desert — deserts fixed, main and unexplored apart, no
  adjacent red, no red on gold, robber as printed; Wonders — deserts and small islands fixed, main island
  redealt, no red next to a desert, robber on its printed desert. Pirate Islands, Forgotten Tribe and Cloth for
  Catan ignore the option (Pirate Islands: "not recommended"; the other two are not in this stage).

## Side task — stronger, more distinct bots (owner request 2026-10-29, do after the expansions)
Owner feels all three levels play the same and too timidly: bots sit on 10+ cards instead of
building, trading and racing for points. Wanted: clearly different levels, and Hard must be
genuinely hard (spend cards, trade actively, plan towards VP). Measure before/after with seeded
bot-vs-bot games (win rates per level, average hand size at turn end, cards lost to 7s).

## Game screen look (2026-10-28)

- Bots get random names from a pool of 25 men + 25 women (server stores `Bot#<index>`,
  client shows the Hebrew/English name; old `Bot N` rooms still display). Names stay
  put when the lobby config changes. The home screen draws the names up front and sends
  them with `room:create`, so the host sees the same names before and after.
- Whose turn: the active chip steps forward, a light sweeps across it, then it glows
  slowly in the player's colour; other chips dim. Reduced motion keeps a static glow.
- 3D: the wooden table is gone. The painted sea (sea.webp) is drawn as a full square that fades out
  into its own deep rim colour, which carries on to the horizon: one sea, no hex edge (owner
  rejected both a wave texture and a hard edge). Hand panel is deep lagoon blue instead of wood.

## Rules (classic base game)
- 19 hexes (4 forest/lumber, 3 hills/brick, 4 pasture/wool, 4 fields/grain,
  3 mountains/ore, 1 desert), 3-4-5-4-3 layout; 18 number tokens; no adjacent 6/8;
  robber starts on desert; 9 harbors (4×3:1, 5×2:1). Optional fixed beginner board.
- Bank: 19 per resource. Shortage: if one player entitled → give what's left;
  if several entitled → nobody gets that resource that roll.
- Pieces per player: 15 roads, 5 settlements, 4 cities.
- Costs: road L+B; settlement L+B+W+G; city 2G+3O; dev card W+G+O.
- Opening roll (owner's decision, phase `ORDER_ROLL`): every player rolls 2 dice; the
  turn order is the ranking by roll, highest first (tied players reroll among themselves).
  Note: the official rule is "highest starts, then clockwise"; here the whole order is by roll.
- Setup snake order over the turn order (A,B,C,C,B,A). Settlement + connected road each
  step. Second settlement yields 1 card per adjacent producing hex. Nobody starts with
  any other cards. Regular turns follow the same turn order.
- Distance rule; roads connect to own network, can't pass through opponent buildings.
- 7: everyone with >7 cards discards floor(n/2) (simultaneously, players choose),
  then active moves robber to a different hex, then steals 1 random card from a
  chosen eligible victim (auto if only one).
- Dev deck 25: 14 knight, 5 VP, 2 road building, 2 year of plenty ("Invention" in the
  2025 rulebook, shown as "המצאה"), 2 monopoly.
  One non-VP card per turn, not on the turn bought, playable pre-roll or main phase.
  Knight pre-roll does not replace the roll. Monopoly takes from ALL opponents.
- Longest Road ≥5 (2 VP), Largest Army ≥3 knights (2 VP); must strictly exceed holder.
  Broken-road tie among non-holders → nobody holds it.
- Win: ≥ target VP during own turn (checked after every action and at turn start).

## Player trading (multi-player interpretation)
- Only active player proposes, in MAIN_ACTIONS. Offer sent to chosen opponents.
- Recipients accept / reject / counter. Single recipient accepting → executes
  immediately. Multiple recipients → active player confirms with one of them.
- Both sides must give ≥1 card. A resource may not appear on both sides (rulebook:
  "3 ore for 1 ore" is giving cards away). Revalidated on execution. Cancelled at end of turn.

## Architecture
- npm workspaces monorepo, TypeScript:
  - `packages/engine` — pure rules engine (`applyAction(state, player, action)`),
    seeded RNG stored in state, per-player views hiding private info. Bots live here.
  - `packages/server` — Node + Express + Socket.IO; rooms, player tokens,
    persistence after every action, revision + requestId dedupe, broadcasts views.
  - `packages/client` — React + Vite, SVG board, mobile UI.
- Persistence: JSON files locally; Postgres when `DATABASE_URL` is set.
- Hosting (free): Render web service + Neon free Postgres. Accept ~30–50s cold start.
- Tests: Vitest (engine/server), Playwright two-browser later.

## Leaving and abandoned games (owner decision, 2026-10-16)
- Any player can choose "Exit game" (☰ menu, lobby, or victory screen) after a confirmation.
  Exiting closes the game for EVERY player and deletes it completely (no trace in storage).
  Other players see "X left, so the game was closed and deleted".
- If any human player has been away (not connected) for more than 10 minutes, the game is
  closed and deleted ("closed because X was away more than 10 minutes"). Applies to games
  vs friends and solo games vs bots. `lastSeen` per seat is persisted, so the rule also
  holds after a server restart / Render sleep (checked when the room is loaded) and a
  sweep runs every minute (`ABSENCE_LIMIT_MS` env, default 600000).
- This replaces the original PRD rule "a disconnected player can always rejoin later";
  reconnecting within 10 minutes still restores the game.

## Hidden info
Others see only: structures, public VP, resource-card count, dev-card count,
knights played, achievements. Never: their resources, dev card identities, deck
order, RNG seed.

## Milestones
1. Engine: board, graph, setup, production, building — DONE
2. Engine: robber, trading, dev cards, achievements, victory + tests — DONE
3. Multiplayer server + client → playable on two phones — DONE (verified with two browsers locally)
4. Bots Easy/Medium/Hard — DONE. `engine/src/bot.ts` decides from the bot's own PlayerView;
   `server/src/bots.ts` runs them (900 ms pause, `BOT_DELAY_MS`), resumes after restart,
   withdraws a bot's unanswered offer after 20 s. Solo play (1 human + 1–3 bots) supported.
   Measured: 3-way games easy 1 / medium 22 / hard 37 wins of 60; hard vs medium 22–18.
4b. Rulebook review (6th ed. 2025) — DONE; only gap found was same-resource trades (fixed).
4c. Hebrew UI + visual redesign — DONE.
5. Mobile polish, animations, sounds, PWA — basic versions exist (sfx, dice anim, sw.js)
6. Deploy to Render + Neon — LIVE at https://hex-islands-j3bn.onrender.com (auto-deploys on push to main). Playwright e2e still TODO

## Code map
- `packages/engine/src/game.ts` — createGame, applyAction (all rules), scoring
- `packages/engine/src/queries.ts` — legal spots, harbor rates, longest road (shared by UI/bots)
- `packages/engine/src/view.ts` — per-player view (hidden info stripped)
- `packages/engine/src/mods/` — mod definitions (`base.ts`) and registry (`MODS`, `modFor`)
- `packages/engine/src/geometry.ts` — board graph per layout: `boardGraph(board)` / `graphFor(layout)`
- `packages/server/src/rooms.ts` — RoomManager (lobby, tokens, revision/dedupe, act)
- `packages/server/scripts/autoplay.ts` — dev tool to fast-forward a live room
- `packages/client/src/game/GameScreen.tsx` + `Panels.tsx` + `Board.tsx` — game UI
- `packages/engine/src/bot.ts` — AI decisions; `packages/engine/src/log.ts` — log keys
- `packages/server/src/bots.ts` — server-side bot runner
- `packages/client/src/i18n.ts` — Hebrew/English strings, log + error translation
- `packages/client/src/art.tsx` — original SVG art (resource/dev cards, pieces shading)

## Hosting notes / open options
- Render free sleeps after ~15 min idle → first visit takes ~30–50 s (owner noticed, 2026-10-15).
- Option A (free, owner considering, not done yet): UptimeRobot HTTP(s) monitor on
  `https://hex-islands-j3bn.onrender.com/healthz` every 5 min keeps it awake. Fits Render's
  750 free hours/month. Gray area with Render's policy. Neon still sleeps but wakes in <1 s.
- Option B (paid, ~$7/month): Render Starter plan — never sleeps, no workaround needed.
- GitHub Actions cron was rejected: on a private repo it would exceed the free minutes.

## Documented interpretations / deviations
- PostgreSQL replaced by file store locally (Postgres in prod) — simpler for a private game.
- `ROLL_RESOLUTION` is resolved inside the roll action (instant), not a waiting phase.
- Revision check is enforced for active-player actions; `discard` and trade
  responses (non-active players acting in parallel) are revalidated instead.
- Road Building: player may finish early (forfeits remaining free roads).
