# Hex Islands — Consolidated Spec (single source of truth)

Merges `prd-catan.md` (original) + `update.md` (binding override wherever the
original limits the game to 2 players) + decisions agreed with the owner.
Read this file instead of the originals; consult them only for fine detail.

## Product
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
- Design roadmap: phase 2 = three.js 2.5D/3D board (tilted camera, extruded tiles with
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
