# Hex Islands — Consolidated Spec (single source of truth)

Merges `prd-catan.md` (original) + `update.md` (binding override wherever the
original limits the game to 2 players) + decisions agreed with the owner.
Read this file instead of the originals; consult them only for fine detail.

## Product
- Private online board game inspired by base CATAN (no expansions). Original
  name/art/sounds — no official logos/assets.
- Owner plays with girlfriend/friends on separate phones via an invite link.
- Mobile-first PWA. **UI language: English now**, all strings kept in one
  place so Hebrew (RTL) can be added later.

## Participants (update.md is binding)
- 2–4 total participants, any mix of humans and bots: `2 <= humans + bots <= 4`, bots ≤ 3.
- All 9 combos supported (1H+1-3B, 2H+0-2B, 3H+0-1B, 4H).
- Default config: 2 humans + 2 Medium bots, target 10 VP.
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
- Dev deck 25: 14 knight, 5 VP, 2 road building, 2 year of plenty, 2 monopoly.
  One non-VP card per turn, not on the turn bought, playable pre-roll or main phase.
  Knight pre-roll does not replace the roll. Monopoly takes from ALL opponents.
- Longest Road ≥5 (2 VP), Largest Army ≥3 knights (2 VP); must strictly exceed holder.
  Broken-road tie among non-holders → nobody holds it.
- Win: ≥ target VP during own turn (checked after every action and at turn start).

## Player trading (multi-player interpretation)
- Only active player proposes, in MAIN_ACTIONS. Offer sent to chosen opponents.
- Recipients accept / reject / counter. Single recipient accepting → executes
  immediately. Multiple recipients → active player confirms with one of them.
- Both sides must give ≥1 card. Revalidated on execution. Cancelled at end of turn.

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

## Hidden info
Others see only: structures, public VP, resource-card count, dev-card count,
knights played, achievements. Never: their resources, dev card identities, deck
order, RNG seed.

## Milestones
1. Engine: board, graph, setup, production, building — DONE
2. Engine: robber, trading, dev cards, achievements, victory + tests — DONE (75 tests)
3. Multiplayer server + client → playable on two phones — DONE (verified with two browsers locally)
4. Medium bot (then Easy/Hard as strategy variants) — NEXT. Server currently rejects bots>0
   (`BOTS_ENABLED` in `packages/server/src/rooms.ts`); Home screen shows bots as "coming soon".
5. Mobile polish, animations, sounds, PWA — basic versions exist (sfx, dice anim, sw.js)
6. Deploy to Render + Neon — LIVE at https://hex-islands-j3bn.onrender.com (auto-deploys on push to main). Playwright e2e still TODO

## Code map
- `packages/engine/src/game.ts` — createGame, applyAction (all rules), scoring
- `packages/engine/src/queries.ts` — legal spots, harbor rates, longest road (shared by UI/bots)
- `packages/engine/src/view.ts` — per-player view (hidden info stripped)
- `packages/server/src/rooms.ts` — RoomManager (lobby, tokens, revision/dedupe, act)
- `packages/server/scripts/autoplay.ts` — dev tool to fast-forward a live room
- `packages/client/src/game/GameScreen.tsx` + `Panels.tsx` + `Board.tsx` — game UI
- `packages/client/src/strings.ts` — all UI labels (add Hebrew here)

## Documented interpretations / deviations
- PostgreSQL replaced by file store locally (Postgres in prod) — simpler for a private game.
- `ROLL_RESOLUTION` is resolved inside the roll action (instant), not a waiting phase.
- Revision check is enforced for active-player actions; `discard` and trade
  responses (non-active players acting in parallel) are revalidated instead.
- Road Building: player may finish early (forfeits remaining free roads).
