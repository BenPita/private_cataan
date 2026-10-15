# HEX ISLANDS
## Complete Game Rules & Mobile Multiplayer Development Specification

**Project Type:** Mobile-friendly online multiplayer strategy board game  
**Primary Players:** 2 human players  
**Platform:** Mobile web application (PWA)  
**Inspired by:** The core gameplay mechanics of classic CATAN, without expansions  
**Goal:** Build a complete, polished, playable game that can be shared via a private link.

---

# PART 1: PROJECT OBJECTIVE

## 1.1 Game Vision

Create a fully functional, turn-based strategy board game inspired by the classic base version of CATAN.

The game should allow two people to play together online from separate mobile phones, even when they are in different physical locations.

It should include the complete core gameplay experience:

- A hexagonal island board
- Resource production based on dice rolls
- Roads, settlements, and cities
- Resource management
- Player-to-player trading
- Bank and harbor trading
- Development cards
- Robber mechanics
- Longest Road and Largest Army
- Victory points
- Automatic rule enforcement
- Multiplayer synchronization
- A complete game from setup to victory

This is not intended to be a static board, prototype, or visual demonstration.

**The final result must be a genuinely playable game with a working multiplayer backend.**

## 1.2 Original Design Requirements

Use an original game name, interface, artwork, terrain illustrations, sound effects, and branding.

Do not use official CATAN logos, copyrighted illustrations, original game assets, or proprietary interface designs.

The gameplay should follow the familiar resource-management and territory-building mechanics described below, while presenting an original visual identity.

---

# PART 2: GAME OVERVIEW

## 2.1 Objective

Players compete to become the first player to reach **10 victory points during their own turn**.

Victory points are earned through:

| Source | Victory Points |
|---|---:|
| Settlement | 1 |
| City | 2 |
| Longest Road | 2 |
| Largest Army | 2 |
| Victory Point development card | 1 |

Cities replace settlements. Therefore, upgrading a settlement to a city increases its value from 1 to 2 points.

The game ends immediately when the active player reaches at least 10 victory points during their turn.

## 2.2 Players

The target implementation supports exactly two human players.

The standard base CATAN game is designed for 3-4 players. This project intentionally includes a simplified two-player adaptation.

For this adaptation:

- Both players use the standard board.
- Both players receive normal resource production.
- Both players alternate turns.
- Normal construction, robber, trading, and victory conditions apply.
- No AI opponents or neutral players are included.
- The simplified two-player mode does not introduce the additional mechanics from official two-player variants.

These adaptations must be clearly separated from the underlying classic rules in the code.

---

# PART 3: BOARD STRUCTURE

## 3.1 Hexagonal Map

The island contains exactly **19 land hexagons**.

| Terrain | Quantity | Produced Resource |
|---|---:|---|
| Forest | 4 | Lumber |
| Hills | 3 | Brick |
| Pasture | 4 | Wool |
| Fields | 4 | Grain |
| Mountains | 3 | Ore |
| Desert | 1 | None |
| **Total** | **19** | |

The island must have the traditional 3-4-5-4-3 hexagonal layout.

Surround the island with ocean graphics and coastal trading harbors.

## 3.2 Number Tokens

There are 18 number tokens placed on producing terrain hexes.

| Dice Number | Quantity |
|---|---:|
| 2 | 1 |
| 3 | 2 |
| 4 | 2 |
| 5 | 2 |
| 6 | 2 |
| 8 | 2 |
| 9 | 2 |
| 10 | 2 |
| 11 | 2 |
| 12 | 1 |

The number 7 never appears on a producing hex.

The desert has no number token.

Each token controls which resource hex produces when that number is rolled.

Numbers 6 and 8 should be visually emphasized because they have the highest production probability.

## 3.3 Random Board Generation

At the beginning of a match:

1. Generate the 19 hexes.
2. Shuffle their terrain assignments.
3. Assign the 18 number tokens to non-desert hexes.
4. Place the robber on the desert.
5. Generate the harbor locations.
6. Validate the board before allowing play.

Use a balanced map generator that avoids adjacent 6 and 8 tokens.

A fixed beginner-friendly board may also be offered.

Both players must always receive exactly the same generated board from the server.

## 3.4 Board Geometry

The board must support three types of positions:

- **Hex tiles:** Resource production and robber placement.
- **Vertices:** Settlements and cities.
- **Edges:** Roads.

All vertices and edges must have stable unique identifiers.

Each vertex must know its adjacent vertices, connected edges, and neighboring hexes.

The rules engine must use this graph representation, not pixel coordinates, to validate construction.

---

# PART 4: RESOURCES

## 4.1 Resource Types

The game has five resources:

1. Lumber
2. Brick
3. Wool
4. Grain
5. Ore

Resources are stored privately in each player's inventory.

Each resource is represented by an original icon and color.

## 4.2 Resource Production

At the start of a normal turn, the active player rolls two six-sided dice.

The dice sum determines which terrain hexes produce resources.

If the result is 8, every unblocked hex carrying an 8 produces resources for players with adjacent settlements or cities.

Production rules:

- Adjacent settlement: 1 resource
- Adjacent city: 2 resources
- No adjacent building: 0 resources
- Desert: never produces
- Hex containing the robber: produces nothing

Production occurs for **both players**, regardless of whose turn it is.

A player can receive resources from multiple producing hexes in the same roll.

A settlement or city can collect from up to three adjacent hexes.

## 4.3 Resource Bank

Use the classic supply of 19 cards per resource type.

If a particular resource supply is insufficient to pay all eligible players, follow these rules:

- If only one player is entitled to that resource, give them as many as available, up to their entitlement.
- If multiple players are entitled to the same resource and there is not enough for all of them, nobody receives that resource on that roll.

Other resource types must still be distributed normally.

Resource supply must be updated when resources are spent, discarded, exchanged, or taken from the bank.

---

# PART 5: GAME SETUP

## 5.1 Starting Procedure

Both players begin with:

- 0 resource cards
- 0 development cards
- 0 played knights
- 0 victory points
- Their full supply of building pieces

Each player has:

| Building | Available Pieces |
|---|---:|
| Roads | 15 |
| Settlements | 5 |
| Cities | 4 |

## 5.2 Initial Placement

The setup phase follows a snake-order placement system.

For two players, use:

**Player A → Player B → Player B → Player A**

Each placement consists of:

1. Placing one settlement.
2. Placing one connected road.

The placement must respect the settlement distance rule.

The second starting settlement provides initial resources based on all adjacent producing hexes.

The desert does not provide resources.

The initial setup placements cost no resources.

After both players complete setup, Player A takes the first regular turn.

## 5.3 Settlement Distance Rule

A settlement cannot be built adjacent to another settlement or city.

This applies to structures belonging to either player.

At least two road edges must separate settlement locations.

The UI must clearly distinguish legal and illegal placement locations.

---

# PART 6: TURN STRUCTURE

## 6.1 Turn Order

Players alternate turns.

A turn consists of:

1. Optional development card play before rolling.
2. Dice roll.
3. Resource production or robber resolution.
4. Trading and building actions.
5. End turn.

Trading and building may occur in any order after the roll.

A player can make multiple legal trades and build multiple structures in the same turn, subject to available resources and pieces.

Only the active player may initiate actions.

## 6.2 Dice Rolling

Two six-sided dice are rolled once per normal turn.

The result ranges from 2 to 12.

Dice must be generated by the authoritative server.

The client must not be able to manually select or manipulate dice values.

Display a short animated dice sequence, followed by the actual result.

Both players must see the result simultaneously.

## 6.3 Turn Phases

Implement these phases as explicit states:

- INITIAL_PLACEMENT
- PRE_ROLL
- ROLL_RESOLUTION
- ROBBER_DISCARD
- ROBBER_MOVE
- ROBBER_STEAL
- MAIN_ACTIONS
- GAME_OVER

Actions must only be available in their permitted phases.

For example, a player must not build before rolling during a normal turn.

---

# PART 7: BUILDING RULES

## 7.1 Building Costs

| Construction | Lumber | Brick | Wool | Grain | Ore |
|---|---:|---:|---:|---:|---:|
| Road | 1 | 1 | 0 | 0 | 0 |
| Settlement | 1 | 1 | 1 | 1 | 0 |
| City | 0 | 0 | 0 | 2 | 3 |
| Development Card | 0 | 0 | 1 | 1 | 1 |

Construction resources are returned to the bank.

## 7.2 Roads

Roads are built on edges connecting adjacent board vertices.

A new road must connect to the player's existing valid road network or settlement/city.

A player's road cannot pass through an intersection occupied by an opponent's settlement or city.

Roads cannot overlap existing roads.

Each player may have at most 15 roads on the board.

## 7.3 Settlements

A settlement:

- Costs one lumber, one brick, one wool, and one grain.
- Is worth 1 victory point.
- Produces one resource for each adjacent producing hex.
- Must obey the distance rule.
- Must connect to one of the player's existing roads during normal play.

A settlement cannot be built on an occupied vertex.

Each player may have a maximum of 5 settlements simultaneously.

## 7.4 Cities

A city must replace an existing settlement owned by the same player.

City properties:

- Costs 2 grain and 3 ore.
- Is worth 2 victory points.
- Produces two resources instead of one.
- Cannot be upgraded further.

Each player may have a maximum of 4 cities.

When a settlement becomes a city, return the settlement piece to its owner's available supply.

---

# PART 8: TRADING

## 8.1 Bank Trading

The default bank exchange rate is:

**4 identical resources → 1 resource of the player's choice**

The player must have sufficient resources.

Trades execute atomically.

## 8.2 Harbor Trading

There are nine harbors:

- Four generic 3:1 harbors.
- Five specific 2:1 harbors, one for each resource type.

A player gains access to a harbor by building a settlement or city at a connected coastal vertex.

Generic harbor:

3 identical resources for any 1 resource.

Specialized harbor:

2 resources of the harbor's type for any 1 resource.

The game must automatically choose the best eligible exchange rate, or display all valid rates.

## 8.3 Player-to-Player Trading

During the active player's main action phase:

1. The active player creates a trade proposal.
2. The other player receives the offer.
3. The other player accepts, rejects, or makes a counteroffer.
4. If accepted, resources transfer simultaneously.

Trading rules:

- Only the active player may initiate trade execution.
- Both sides must contribute at least one resource card.
- Resources cannot be gifted for free.
- Development cards cannot be traded.
- A trade must be revalidated before execution.
- Players cannot trade directly with the other player during initial placement or robber resolution.

The UI should use a simple two-column trade interface.

---

# PART 9: ROBBER MECHANICS

## 9.1 Rolling a Seven

When the dice sum is 7:

1. No resource hex produces.
2. Every player holding more than 7 resource cards discards half, rounded down.
3. The active player moves the robber to a different land hex.
4. If an opponent owns a settlement or city adjacent to the destination hex and holds resource cards, the active player steals one random resource from them.
5. The turn proceeds to the main actions phase.

For example:

- 7 cards: discard 0
- 8 cards: discard 4
- 9 cards: discard 4
- 11 cards: discard 5

Resource discarding occurs before the robber is moved.

Players must choose which resources to discard.

While discarding is unresolved, players cannot trade, build, or end the turn.

## 9.2 Robber Blocking

The robber blocks all production from the hex it occupies.

Buildings adjacent to other unblocked hexes still produce normally.

## 9.3 Robber Stealing

The stolen resource is selected randomly from the opponent's resource inventory.

The stealing player does not get to choose the resource type.

If the opponent has no resource cards, nothing is stolen.

With only two players, the victim selection is automatic when the other player is eligible.

The robber cannot remain on its current hex after being moved.

---

# PART 10: DEVELOPMENT CARDS

## 10.1 Development Deck

The standard development deck consists of 25 cards:

| Card | Quantity |
|---|---:|
| Knight | 14 |
| Victory Point | 5 |
| Road Building | 2 |
| Year of Plenty | 2 |
| Monopoly | 2 |

Development cards are drawn randomly from the shuffled deck.

Purchased cards remain private to their owner.

## 10.2 General Rules

- A player may play at most one playable development card per turn.
- A development card cannot be played on the same turn it was purchased.
- A card may be played before rolling or during the main actions phase when its effect is valid.
- Victory Point cards are not actively played and do not count toward the one-card-per-turn restriction.
- Development cards cannot be exchanged or stolen.
- Unused playable development cards remain available for future turns.

## 10.3 Knight

Playing a Knight:

1. Moves the robber to a different hex.
2. Allows a random resource theft from an eligible opponent.
3. Increases the player's played Knight count by one.

A Knight played before rolling does not replace the normal dice roll.

## 10.4 Road Building

Allows the player to place up to two roads for free.

Both roads must obey normal placement rules.

If only one road can legally be placed, the player may place one.

If no roads can legally be placed, the card may still be resolved with no roads placed.

## 10.5 Year of Plenty

Allows the player to take two resources of their choice from the bank.

The player may choose two resources of the same type or two different types.

Bank availability must be enforced.

## 10.6 Monopoly

The player chooses one resource type.

The opponent must give the active player every card of that resource type they currently hold.

The transfer occurs immediately.

## 10.7 Victory Point Cards

Each Victory Point card is worth one hidden victory point.

The owner may see the card privately.

Other players must not be shown the card until victory or the end of the match.

---

# PART 11: SPECIAL ACHIEVEMENTS

## 11.1 Longest Road

Award 2 victory points to the first player who constructs a continuous road network at least 5 edges long.

Rules:

- Branches are not counted twice in one path.
- Each road edge can be used only once in the evaluated path.
- A player's own settlements and cities do not interrupt the path.
- An opponent's settlement or city interrupts the path.
- Roads may form loops.
- The path length must be calculated using actual board graph connectivity.

If another player builds a strictly longer qualifying road, ownership transfers.

If the current holder loses qualification because their network is interrupted, recalculate ownership according to the classic Longest Road rules, including ties.

## 11.2 Largest Army

Award 2 victory points to the first player who has played at least 3 Knights.

Another player must play strictly more Knights than the current holder to take the achievement.

Unplayed Knight cards do not count.

---

# PART 12: WINNING THE GAME

The game ends when the active player reaches at least 10 victory points during their own turn.

The score includes:

- Settlements
- Cities
- Longest Road
- Largest Army
- Hidden Victory Point cards

Check victory after every score-changing action and at the appropriate point in the turn.

When a player wins:

1. Stop accepting game actions.
2. Display the winner.
3. Reveal final scores.
4. Show a victory animation.
5. Offer a rematch.
6. Allow players to return to the lobby.

A rematch creates a new board and resets all game state.

---

# PART 13: TWO-PLAYER GAME ADAPTATION

The primary mode is a simplified two-player version of the classic game.

**Initial implementation:**

- Two human players only.
- Standard 19-hex board.
- Normal starting settlement placement.
- Normal dice production.
- Normal building costs.
- Normal development cards.
- Standard robbery and seven-discard mechanics.
- Standard 10-point victory condition.
- No neutral settlements or roads.
- No trading tokens.
- No automated opponents.

This adaptation is intentionally not presented as an official CATAN two-player variant.

It should be implemented as a configurable ruleset so balance changes can be introduced later without rewriting the game engine.

Possible future optional settings:

- Target victory points: 10 or 12
- Balanced board generation
- Alternative first-player selection

Do not introduce additional two-player mechanics without explicitly identifying them as optional house rules.

---

# PART 14: ONLINE MULTIPLAYER

## 14.1 Private Game Rooms

The game must support this workflow:

1. Player A opens the game.
2. Player A enters a nickname.
3. Player A clicks **Create Game**.
4. The server creates a private room.
5. Player A receives a shareable invitation URL.
6. Player A sends that URL via WhatsApp.
7. Player B opens the link on another phone.
8. Player B enters a nickname.
9. Player B joins the room.
10. Both players click Ready.
11. The match begins.

Do not require account registration for the first version.

## 14.2 Multiplayer Synchronization

Both phones must always share the same authoritative game state.

Examples:

- A road built on one phone appears on both.
- Resource production updates both players.
- Robber movement appears on both.
- New trades trigger a notification for the recipient.
- The active player's turn is highlighted on both screens.
- The winning result appears on both phones.

Use real-time communication such as WebSockets or a suitable real-time backend.

## 14.3 Server Authority

All important logic must run on the backend:

- Dice rolls
- Deck shuffling
- Resource transfers
- Building validation
- Robber selection
- Legal action checks
- Victory calculations
- Turn ownership

The client sends action requests.

The backend validates them, updates the state, persists the result, and broadcasts authorized updates.

Never trust resource counts, scores, dice results, or building legality submitted directly by a client.

## 14.4 Privacy and Hidden Information

Each player can see their own:

- Resource types and quantities
- Development cards
- Available actions

The opponent sees:

- Public structures
- Public score information
- Total resource card count
- Total development card count
- Played Knights
- Public achievements

The opponent must not receive hidden resource inventories or development-card identities through API responses or real-time messages.

## 14.5 Disconnection Handling

If a player disconnects:

- The match remains stored.
- The other player sees a disconnected status.
- The game is not automatically lost.
- The disconnected player can rejoin.
- The board, resources, and current turn are restored.

Use a secure private player token to identify reconnecting players.

A room invite alone should not grant control over an already claimed player seat.

No permanent turn timer is required in the first version.

## 14.6 Persistence

Save the complete match state after each accepted action.

Persist:

- Game ID
- Players and seat ownership
- Board layout
- Buildings and roads
- Resource inventories
- Development cards and deck order
- Current turn
- Current phase
- Robber location
- Longest Road holder
- Largest Army holder
- Victory points
- Pending trades
- Pending discard selections
- Winner
- Action history and state revision

Reloading the browser must not reset the match.

---

# PART 15: MOBILE USER INTERFACE

## 15.1 Overall Design

Create a polished, colorful strategy-game interface.

The visual style should feel like a modern mobile board game, not an administration dashboard.

Use:

- Illustrated terrain
- Smooth animations
- Distinct player colors
- Clearly readable number tokens
- Attractive resource icons
- Responsive touch interactions
- Subtle sound effects
- Clean menus
- Professional-looking buttons

## 15.2 Main Game Screen

The screen should contain:

**Top area**
- Player names
- Victory points
- Current player indicator
- Opponent connection status
- Opponent total cards

**Center**
- Interactive hexagonal board
- Roads, settlements, and cities
- Robber
- Number tokens
- Coastal harbors

**Bottom area**
- Personal resource inventory
- Build button
- Trade button
- Development cards button
- Dice roll or End Turn button

The board must remain the central visual element.

## 15.3 Touch Controls

Support:

- Tap to select a vertex.
- Tap to select an edge.
- Pinch to zoom the board.
- Drag to pan.
- Tap a hex to inspect it.
- Highlight valid building locations.
- Display a clear confirmation before spending resources.

Hit targets must be large enough for fingers on mobile devices.

Avoid overlapping clickable elements.

## 15.4 Resource Inventory

Display the five resource types with quantities.

Example:

Lumber: 3  
Brick: 2  
Wool: 1  
Grain: 4  
Ore: 0

Update the inventory immediately after server confirmation of any action.

Show a small animation whenever resources are gained or spent.

## 15.5 Construction Menu

The Build menu should include:

- Road
- Settlement
- City
- Development Card

For each item, show:

- Resource cost
- Number of remaining pieces
- Whether it is currently affordable
- Legal placement locations

Unavailable options should be disabled with a helpful explanation.

## 15.6 Trading Interface

Provide separate tabs:

**Bank Trade**
- Select resource to give.
- Select resource to receive.
- Display exchange rate.
- Confirm exchange.

**Player Trade**
- Select offered resources.
- Select requested resources.
- Send proposal.
- Accept, reject, or counteroffer.

Both players must see trade updates in real time.

## 15.7 Dice Experience

The Roll Dice button must be prominent when available.

On tapping it:

1. Trigger the server dice roll.
2. Display animated dice.
3. Show the result.
4. Highlight producing hexes.
5. Animate resources moving to eligible players.
6. Continue into the appropriate phase.

Animations must not block required rules processing.

## 15.8 Additional Screens

Create:

- Home screen
- Create Game screen
- Join Game screen
- Waiting lobby
- Main board
- Trade interface
- Development card interface
- Game rules/help screen
- Settings
- Victory screen
- Rematch flow

---

# PART 16: TECHNICAL ARCHITECTURE

## 16.1 Recommended Technology

Build the first version as a mobile-first Progressive Web App.

Suggested stack:

**Frontend**
- React
- TypeScript
- Vite
- SVG or Canvas board rendering
- Responsive CSS

**Backend**
- Node.js
- TypeScript
- Socket.IO or equivalent real-time communication

**Persistence**
- PostgreSQL or another durable database

**Deployment**
- HTTPS hosting
- Persistent backend
- Secure environment variables
- Production-safe real-time connections

Claude may choose a better-supported architecture, but must explain any major changes.

## 16.2 Game Rules Engine

Implement a standalone game rules engine that is independent of the user interface.

It should include:

- Board generation
- Graph connectivity
- Turn state machine
- Dice resolution
- Resource accounting
- Building validation
- Trading validation
- Development-card logic
- Robber resolution
- Achievement calculations
- Victory detection

Use deterministic pure functions wherever practical to simplify testing.

## 16.3 Action Processing

Each action request must include:

- Game ID
- Authenticated player identity
- Action type
- Action-specific parameters
- Expected game-state revision
- Unique action request ID

The backend must:

1. Confirm the player belongs to the match.
2. Confirm the action is permitted in the current phase.
3. Validate ownership and available resources.
4. Apply the action atomically.
5. Update the persistent match state.
6. Increment the revision.
7. Broadcast the appropriate public and private updates.

Duplicate action requests must not produce duplicate effects.

---

# PART 17: EDGE CASES AND ERROR HANDLING

The game must safely handle at least the following scenarios.

## Construction Validation

- A player attempts to build without sufficient resources.
- A settlement violates the distance rule.
- A road is not connected to a valid network.
- A road attempts to cross an opponent-controlled intersection.
- A player attempts to build on an occupied edge.
- A player attempts to exceed the structure limit.
- A player attempts to upgrade another player's settlement.
- A player upgrades their last available settlement into a city.
- A city upgrade unexpectedly changes the Longest Road calculation.
- Two actions attempt to use the same resources.

## Resource Production

- Multiple players collect from the same hex.
- One city and one settlement receive resources from the same hex.
- The robber blocks one of several otherwise producing hexes.
- The bank has insufficient resources for simultaneous production.
- A player owns several producing structures.
- Production is triggered while a client temporarily disconnects.

## Robber

- A player has exactly 7 cards.
- A player has 8 or more cards.
- Both players must discard.
- The opponent disconnects during discarding.
- The robber is moved to its current hex.
- The victim has no cards.
- A Knight is played before rolling.
- A seven is rolled after a Knight was already played.
- A player attempts to skip a required robber action.

## Trading

- A trade is accepted after the offer has become invalid.
- An opponent rejects a trade.
- Both players send conflicting trade actions.
- A player submits an offer containing more resources than they own.
- A trade remains pending when a connection drops.
- A player attempts to trade before resolving a seven.
- A player attempts to trade development cards.
- Bank or harbor resource supplies cannot satisfy a trade.

## Development Cards

- A newly purchased card is played in the same turn.
- Multiple development cards are played in one turn.
- The development deck is empty.
- A Monopoly card targets a resource the opponent does not have.
- Road Building is used with insufficient legal road positions.
- Year of Plenty requests unavailable bank resources.
- A Victory Point card causes the active player to reach 10 points.
- A card effect is interrupted by network loss.

## Multiplayer

- Both players click Ready simultaneously.
- A player refreshes during a dice animation.
- A player refreshes during initial placement.
- A player loses connection during a trade.
- A player tries to act out of turn.
- The same request is submitted twice.
- Both clients have different state revisions.
- A third person opens the invite link.
- Someone attempts to impersonate a player.
- A previous player reconnects after changing phones.
- A disconnected player's game state is restored incorrectly.

## Scoring

- A settlement is upgraded to a city.
- Longest Road is broken by an opponent.
- Longest Road ownership changes.
- Longest Road becomes tied.
- Largest Army transfers to another player.
- Multiple scoring changes happen in the same action.
- The player reaches 10 points using a hidden Victory Point card.
- An inactive player temporarily has 10 points.
- The game receives an action after completion.

Every failed action should return an understandable error without corrupting or partially modifying the game state.

---

# PART 18: AUTOMATED TESTING

Create automated tests for the rules engine and multiplayer behavior.

Use a testing framework appropriate for the selected technology.

Required test categories:

1. Unit tests for building costs and placement.
2. Unit tests for resource production.
3. Unit tests for robber discard calculations.
4. Unit tests for trading and harbor rates.
5. Unit tests for development-card restrictions.
6. Graph-based tests for Longest Road.
7. Unit tests for Largest Army.
8. Victory-condition tests.
9. State-machine transition tests.
10. Multiplayer synchronization tests.
11. Reconnection and persistence tests.
12. Security and authorization tests.
13. Two-browser end-to-end tests.

Tests must include negative scenarios, not only successful actions.

A visual interface does not prove the game works. The rules must be validated programmatically.

---

# PART 19: DEVELOPMENT MILESTONES

## Milestone 1: Functional Board

Deliver:

- Interactive 19-hex board
- Correct number tokens
- Board graph
- Two-player initial placement
- Roads and settlements
- Basic rules engine

## Milestone 2: Core Gameplay

Deliver:

- Dice rolling
- Resource production
- Building costs
- Cities
- Turn management
- Player inventories
- Basic scoring

## Milestone 3: Complete Rules

Deliver:

- Robber
- Discarding
- Bank trading
- Harbors
- Development cards
- Longest Road
- Largest Army
- Victory detection

## Milestone 4: Real Multiplayer

Deliver:

- Private rooms
- Shareable invitations
- Two-device synchronization
- Secure player sessions
- Automatic game saving
- Reconnection

## Milestone 5: Mobile Polish

Deliver:

- High-quality responsive interface
- Touch controls
- Animations
- Improved visual design
- Error messages
- Sounds and optional settings
- Installable PWA

## Milestone 6: Production Readiness

Deliver:

- Automated tests
- Security validation
- Reconnection testing
- Two-device testing
- Deployment configuration
- Complete setup instructions
- Publicly accessible HTTPS game URL

---

# PART 20: ACCEPTANCE CRITERIA

The project is considered complete only when:

- [ ] Two people can open the game on separate mobile phones.
- [ ] One person can create a private game.
- [ ] The other person can join using a shared link.
- [ ] Both players can place their starting settlements and roads.
- [ ] Dice rolls produce the correct resources.
- [ ] All building costs and restrictions work.
- [ ] Bank, harbor, and player trading work.
- [ ] The robber behaves correctly.
- [ ] Development cards function correctly.
- [ ] Longest Road and Largest Army are calculated correctly.
- [ ] Victory points are accurate.
- [ ] The game ends correctly at 10 victory points.
- [ ] Hidden information stays private.
- [ ] Both devices remain synchronized.
- [ ] Refreshing the browser does not reset the match.
- [ ] A player can disconnect and later reconnect.
- [ ] Invalid actions are rejected by the backend.
- [ ] The interface is comfortable on modern Android and iOS phones.
- [ ] The game is deployed and accessible through a working HTTPS URL.
- [ ] Automated rules and multiplayer tests pass.

---

# PART 21: INSTRUCTIONS TO CLAUDE

You are acting as a senior full-stack developer, multiplayer game architect, and mobile game UI/UX designer.

Your task is to turn this specification into a complete, working game.

Follow these instructions:

1. Read the entire specification before implementing anything.
2. Treat the rules engine as the authoritative source of gameplay behavior.
3. Implement the two-player ruleset defined here.
4. Do not silently introduce expansions or additional game mechanics.
5. Build an actual application with frontend and backend functionality.
6. Prioritize correct gameplay logic over visual decoration.
7. Build a clean, attractive, touch-friendly mobile interface.
8. Ensure all game actions are synchronized between separate devices.
9. Keep resource inventories and development cards private.
10. Add automated tests for complex rules and negative scenarios.
11. Implement game saving and reconnecting from the beginning.
12. Use original branding and original visual assets.
13. Provide a clear and maintainable source-code structure.
14. Explain how to run, test, and deploy the application.
15. Do not use mock multiplayer behavior or pretend that local client state is real synchronization.
16. Where rules are ambiguous, consult the official base-game rules and document the interpretation. Do not silently change gameplay.

**Start by presenting the proposed architecture, project structure, and phased implementation plan. Then begin implementing the first playable milestone. Continue toward a fully working two-player mobile game.**

## Final Product Vision

The intended experience is simple:

I open the game on my phone, create a room, and send my girlfriend an invitation link.

She opens the link on her phone, joins the room, and we start playing.

We build settlements, collect resources, trade, use development cards, compete for achievements, and try to reach 10 victory points.

Everything works smoothly in real time.

The result should feel like a complete private online board game that we can enjoy together whenever we want.

**End of specification.**