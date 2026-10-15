# Multiplayer & AI Bots - Updated Game Specification

## 1. Game Configuration

The game must support **2 to 4 total participants**, including any combination of human players and AI-controlled bots.

The default configuration is:

- Human players: 2
- AI bots: 2
- AI difficulty: Medium
- Total participants: 4
- Victory target: 10 points

Players must be able to customize these settings before starting a new match.

### Supported Player Combinations

| Human Players | AI Bots | Total Participants |
|---|---|---|
| 1 | 1 | 2 |
| 1 | 2 | 3 |
| 1 | 3 | 4 |
| 2 | 0 | 2 |
| 2 | 1 | 3 |
| 2 | 2 | 4 |
| 3 | 0 | 3 |
| 3 | 1 | 4 |
| 4 | 0 | 4 |

All nine combinations must be supported.

Two human players must be able to play together without any bots, or optionally add one or two bots.

A single human player must also be able to play against one, two, or three bots.

## 2. Game Creation Screen

The Create Game screen must allow the host to configure:

**Human Players:** 1, 2, 3, or 4

**AI Bots:** 0, 1, 2, or 3, constrained by the maximum of four total participants.

**Bot Difficulty:**
- Easy
- Medium (default)
- Hard

The configuration must enforce:

`2 <= humanPlayers + botCount <= 4`

The number of AI bots must not exceed three.

The player configuration cannot be changed after the match starts.

## 3. Bot Intelligence

AI bots must operate as fully independent players within the normal game rules.

They must never receive extra resources, manipulate dice rolls, inspect hidden opponent cards, or bypass construction restrictions.

### Easy

- Prioritizes basic construction.
- Makes simple resource trades.
- Chooses reasonable but not necessarily optimal settlement locations.
- Uses development cards with basic logic.

### Medium

- Evaluates production probability for settlement locations.
- Prioritizes useful resource combinations.
- Plans roads toward valuable intersections.
- Balances settlements, cities, and development cards.
- Makes strategically reasonable trades.
- Uses the robber to interfere with opponents.
- Competes for Longest Road and Largest Army when beneficial.
- Attempts to win efficiently without perfect decision-making.

### Hard

- Evaluates multiple possible future actions.
- Plans construction several turns ahead.
- Optimizes production and resource diversity.
- Considers opponents' strategies.
- Uses harbors strategically.
- Calculates the value of potential trades.
- Makes more sophisticated robber and development-card decisions.
- Actively pursues victory.

Difficulty must affect strategic decision-making, not access to information or game rules.

## 4. AI Turn Execution

Bots must be controlled by the authoritative backend.

When a bot's turn begins, it should automatically:

1. Consider whether to play an eligible development card before rolling.
2. Roll the dice.
3. Resolve resource production or robber actions.
4. Evaluate available resources.
5. Decide whether to trade.
6. Construct roads, settlements, cities, or buy development cards when strategically appropriate.
7. Consider using an eligible development card.
8. End its turn.

Bots must also handle initial settlement placement, mandatory discards, robber movement, theft selection, and trade proposals received from humans.

Their actions must be visible on all connected devices.

Add brief configurable animations or pauses between bot actions so humans can understand what happened.

The game must remain responsive during AI turns.

## 5. AI Trading Behavior

Bots should be capable of:

- Proposing legal trades to human players during their own turns.
- Accepting or rejecting human trade offers.
- Making counteroffers.
- Trading with the bank.
- Using available harbor exchange rates.

Only the active player may initiate player-to-player trading. Bots must follow the same trading rules as humans.

AI trade decisions should consider its resource needs and the strategic value of the proposed exchange.

## 6. Multiplayer Lobby

The lobby must show all available participant slots.

Example default lobby:

| Slot | Participant |
|---|---|
| Player 1 | Human - Host |
| Player 2 | Human - Invited |
| Player 3 | Medium AI |
| Player 4 | Medium AI |

The host should be able to:

- Choose the number of human players.
- Add or remove AI bots.
- Set bot difficulty.
- Copy an invitation link.
- Start the match once all required human players have joined and are ready.

Bots do not require invitations or readiness confirmation.

In a solo game, the host can start immediately after choosing the bots.

## 7. Rules for Different Player Counts

### Three or Four Total Participants

Use the standard classic base-game rules, regardless of whether participants are human or AI-controlled.

### Two Total Participants

Use the simplified two-player ruleset defined in the original specification, without adding neutral players or automatically creating extra bots.

Make the two-player ruleset modular so optional balancing rules can be introduced later.

The game must never silently add AI participants.

## 8. Technical Requirements

- Human and AI players must use the same rules engine and action validation.
- Every bot must have a unique player ID.
- Bot decisions must execute on the server.
- AI actions must update the persistent match state.
- All connected human players must receive synchronized updates.
- AI decisions must use only information legally available to that player.
- AI turns must recover safely after server restarts.
- Bots must not execute duplicate actions after reconnection or retry.
- AI computations must have safe execution limits.
- A bot must always have a valid fallback action, including ending its turn when permitted.

## 9. Required Automated Tests

Test all nine supported player combinations.

Additionally, test:

- Solo game against one bot.
- Solo game against three bots.
- Two humans without bots.
- Two humans with one bot.
- Two humans with two bots.
- Four humans without bots.
- Bot initial placement.
- Bot resource production.
- Bot trading decisions.
- Bot development-card usage.
- Bot robber decisions.
- Bot victory.
- Bot turn recovery after server restart.
- Bot behavior with no available construction options.
- Invalid configuration rejection.
- Hidden-information protection.

## 10. Instructions to Claude

Update the existing game architecture to support configurable human and AI participant slots.

Implement Medium difficulty first because it is the default difficulty.

Build the AI decision-making system as a modular component so Easy and Hard strategies can be added without changing the rules engine.

Do not implement bots as cosmetic placeholders. They must be able to complete entire matches independently while following all game rules.

The default experience should allow two human players on separate mobile phones to compete against two Medium AI bots in a full four-participant match.

Preserve every other requirement from the original game specification.