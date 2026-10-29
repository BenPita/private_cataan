# Seafarers — roadmap (official 2025 rulebooks CN3083 + CN3084)

Rulebooks (owner's PDFs, text + page renders): `C:\Users\user\Downloads\CN3083 CATAN–Seafarers Rulebook 2025 secured reduced.pdf`
(20 pages), `CN3084 CATAN – Seafarers_ 5-6 Player_ Rulebook.pdf` (12 pages). Every scenario page has
a component table (hex counts by terrain, number-disc counts, ports, VP tokens) — use it to
cross-check every transcribed map.

Owner decisions: one mod per game; 2 participants play the **3-player map**; 5–6 participants use
the Seafarers 5–6 maps and the paired-players turn (same as base 5–6).

## Core rules (apply to every scenario) — rulebook pages 1–3
- **Sea hexes** and **gold fields** (new terrains). A gold field that produces gives each adjacent
  settlement 1 resource of the owner's choice, each city 2 in any combination.
- **Ships** (lumber + wool; 15 per player; 0 VP; count for Longest Route). Placed on empty edges of
  sea hexes. A road and a ship may not share a coastal edge. A new ship must connect to one of your
  ships or buildings (not to a road). May not be built past an opponent's building, nor on an edge of
  the hex holding the pirate.
- **Move 1 ship per turn** (Action phase): not one built this turn; only a ship with an "open" end
  (not next to your ship or building); never a ship in a continuous line of ships connecting two of
  your buildings (even if an opponent's building interrupts it); not to/from an edge of the pirate's
  hex. Re-place it obeying normal placement rules.
- **Longest Route** = roads and/or ships; a road and a ship only join at one of your buildings.
- **Pirate**: on a 7 (and with a Knight) you choose robber OR pirate. Pirate moves to the frame or a
  new sea hex; steal 1 random card from a player with a ship on that hex.
- **Road Building** = 2 roads, 2 ships, or 1 + 1. **Knight** = activate robber or pirate.
- **Setup**: variable-setup placement (our snake); a coastal starting settlement may take a ship on an
  adjacent sea edge instead of a road. Scenario may restrict where starting settlements go.
- Ports per scenario map (edge between land and sea / land and frame), never on adjacent edges.

## Scenarios (each = map(s) for 3p, 4p, 5–6p + rules + victory points)
1. Heading for New Shores — +2 VP for your first settlement on each small island; win 14.
2. The Four Islands (5–6: The Six Islands) — home islands = islands of your starting settlements;
   +2 VP first settlement on each other island; win 13.
3. The Fog Islands — empty hex spaces; a road/ship next to an intersection with an empty space
   reveals the top face-down hex (+ number disc, + 1 resource if land); win 12.
4. Through the Desert — desert splits main island; unexplored regions +2 VP; win 14.
5. The Forgotten Tribe — settlements only on numbered hexes; VP tokens / dev cards / ports placed on
   sea edges, taken by building/moving a ship onto them; captured ports placed at your coastal
   settlements; win 13.
6. Cloth for Catan — villages (numbered small-island hexes) with cloth tokens; trade relations by a
   route to a village; cloth on village roll; 2 cloth = 1 VP; 3 starting settlements (resources for
   the 3rd); no Longest Route; robber not on small islands; pirate only after your first village
   route; win 14 or end when 5+ villages are empty.
7. The Pirate Islands — pirate fleet moves along a path each roll (lower die), attacks adjacent
   buildings; warships via Knight (and VP cards in 4p); single line of ships to your beachhead and
   fortress; conquer fortress (3 lair tokens); 7 = steal from any player; no Longest Route / Largest
   Army; win 10 VP + your fortress.
8. The Wonders of Catan — wonder tiles with requirements; 4 levels each costing 5 resources; +1 VP
   first settlement on each small island; win by finishing your wonder, or 10 VP and the highest
   wonder level. No pirate.
9. New World — random islands, +1 VP per unexplored island, win 12.

## Stages (each stage: engine + tests, client, localhost check rule by rule, owner review, deploy)
- **S1 Core + scenario 1**: terrains sea/gold, scenario layouts (any hex shape incl. sea), ships,
  ship moving, pirate, gold choice, Longest Route with ships, Road Building/Knight changes, coastal
  setup ship, island regions + first-settlement VP bonus, per-scenario victory target. Scenario picker
  under the Seafarers box. 3p + 4p maps of "Heading for New Shores" (2p uses 3p). Art: sea + gold
  tiles, ships, pirate, VP tokens; 2D and 3D.
- **S2** Scenarios 2 and 4 (maps + home/unexplored island rules).
- **S3** Scenario 3 Fog Islands (hidden stacks + discovery). DONE 2026-10-29.
- **S4** Scenarios 5 and 6.
- **S5** Scenarios 7 and 8.
- **S6** New World (random generator) + "variable setup" options for 1–4/8.
- **S7** Seafarers 5–6 maps for every scenario (+ wonders Lighthouse, Great Library).
- Then the side task: stronger, more distinct bots (SPEC).

Bots must play every scenario (build/move ships, choose gold, pick robber vs pirate); each stage
adds full bot games per scenario to the tests.
