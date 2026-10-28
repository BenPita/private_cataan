# Stage 2 — Base game for 5–6 players (official CATAN 5–6, 2025)

Source: owner-supplied rulebook `CN3082 CATAN – 5-6 Rulebook 2025` (read in full). Rules summary:

- Board: 30 land hexes in rows 3-4-5-6-5-4-3. Terrain: hills 5, forest 6, pasture 6, fields 6,
  mountains 5, desert 2. Number discs (28): 2×2, 3×3, 4×3, 5×3, 6×3, 8×3, 9×3, 10×3, 11×3, 12×2.
- Harbors: 11 = base 9 + one 3:1 + one 2:1 wool → generic ×5, lumber, brick, wool ×2, grain, ore.
- Bank 24 per resource (19 + 5). Dev deck 34: knight 20, victory point 5, road building 3,
  invention (year of plenty) 3, monopoly 3.
- New colours: green and purple (pieces in the box). Same pieces per player (15/5/4).
- **Paired players** (replaces the old special building phase): a turn = Player 1 Production +
  Action phase, then Player 2 Action phase. Player 2 = the third player after Player 1 in turn
  order (seat index + 3, for both 5 and 6 players). Player 2 may build, trade with the bank /
  harbors and play 1 development card, but may NOT trade with other players. Player 1 can win on
  their part (game ends immediately); Player 2 can win during their Action phase. Then the dice
  pass left: the next player in turn order becomes Player 1. "Development cards built as player 2
  may be played as normal when you are player 1 and vice versa."
- Fixed ("beginner") setup map (transcribed from page 2, rows top→bottom, left→right):
  ```
  r1: hills10 pasture6 desert
  r2: hills6 fields2 mountains9 hills11
  r3: forest3 mountains11 forest5 fields10 pasture4
  r4: desert pasture5 fields4 mountains6 pasture3 fields8
  r5: forest12 mountains10 pasture2 hills4 forest11
  r6: forest8 fields3 forest9 fields5
  r7: hills9 pasture12 mountains8
  ```
- Variable setup: random hexes; numbers random with no adjacent 6/8 (our existing generator rule).

Our interpretations (record in SPEC): robber starts on the first desert; turn order still from
the opening roll (owner rule); setup snake A..F,F..A unchanged; 5 players simply use 5 colours
(the rulebook's "unused colour placed as neutral settlements" applies only to its *fixed* setup
with pre-printed starting positions, which we don't use).

## Engine
1. `geometry.ts`: layout `'classic56'` (rows 3-4-5-6-5-4-3, centred: row r ∈ -3..3 has 6-|r| hexes;
   q start per r: -3:0, -2:-1, -1:-2, 0:-3, 1:-3, 2:-3, 3:-3). Hex ids row by row, q ascending.
   Re-centre every graph on the centroid of its hex centres (classic is already centred — no
   change), and sort coastal edges around that centre. Export `graphBounds(graph)` (max |x|,|y| of
   vertices) for renderers.
2. Mods: `ModDef.large?: ModDef` = the 5–6 rules of the same mod; `modFor(s)` takes
   `{ config, players }` and returns `large` when players.length > 4. Helper
   `modPlayerRange(def)` → overall min..max. BASE_MOD.large: layout classic56, counts above,
   bank 24, deck above, colours base 4 + green `#3d9a3f` + purple `#7d4fb8`, harborTypes (11),
   harborGaps for the classic56 coast (compute coast length; spread 11 harbors evenly, never two
   on adjacent coastal edges), beginner board above, `pairedPlayers: true`.
   `ModDef.pairedPlayers?: boolean`. Keep base (≤4) byte-identical — regression snapshot must pass.
3. Paired players in `game.ts`: state `paired: { first: number } | null`. On `endTurn` by Player 1
   in a paired-players game: cancel trade, set `paired = { first: p1 }`, `currentPlayer = p2`,
   `turn++`, reset P2's `playedDevThisTurn`, phase `MAIN_ACTIONS`, `hasRolled` stays true, log
   `pairedTurn`. During the paired phase: `proposeTrade`, `respondTrade`, `counterTrade`,
   `confirmTrade` fail ("Player 2 may not trade with other players"); everything else as a normal
   main phase (bank/harbor trade, build, buy/play 1 dev card incl. knight → robber, road
   building). `endTurn` by P2 → `paired = null`, next Player 1 = turnOrder after `first`, normal
   new-turn start (turn++, PRE_ROLL). Victory: checked for the acting player as today (P2 can win
   in its phase). Old saves: `paired` missing → null.
4. View: `paired` is public. Bots: in a paired phase never propose trades; otherwise act as main
   phase. Bot runner on the server already acts for `currentPlayer`.
5. Tests (engine): layout counts (30 hexes, vertices/edges sane, coast length, every hex has
   neighbours); generated 5–6 boards valid (counts, no adjacent 6/8, 11 harbors, none adjacent);
   beginner 5–6 board matches the transcription; createGame with 5 and 6 players → bank 24, deck 34,
   colours; paired flow: P1 endTurn → P2 = order[i+3] acts without rolling, cannot propose trade,
   can bank-trade/build/buy/play dev, P2 endTurn → next P1 in PRE_ROLL; P2 wins in its phase; dev
   card bought as P2 playable next own P1 turn; full bot games with 5 and 6 bots (all levels)
   finish without getting stuck; regression snapshot unchanged.

## Server
`validateConfig`: limits from `modPlayerRange` (humans 1..6, bots 0..5, total 2..6 for base).
Error texts for ≤4 unchanged when the mod has no large rules.

## Client
- Home/ModPicker: participant limit = largest range (6). Mod card shows "2–6 players" and a
  "5–6 players" tag when 5–6 participants are chosen. Lobby steppers up to the mod's max.
- Boards: view size from `graphBounds` (2D viewBox and 3D camera fit / sea plane); sea art per
  layout: generate `public/art/sea-56.webp` with `art-src/extras.py` (parameterise hex centres and
  view size; classic output must stay identical).
- 6 player chips: fit the top bar at 375 px (smaller chips / two rows); check trade dialog lists.
- Paired phase UI: banner "Player 2 — build & bank trade" for everyone; hide player-trade UI for
  P2; dice not shown as pending; i18n he/en; log key for the paired turn.
- Colours green/purple readable on 2D, 3D, chips, cards.
