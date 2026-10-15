export function HelpContent() {
  return (
    <div className="help">
      <h3>Goal</h3>
      <p>Be the first to reach 10 victory points on your own turn.</p>
      <ul>
        <li>Settlement: 1 point · City: 2 points</li>
        <li>Longest Road (5+ roads): 2 points</li>
        <li>Largest Army (3+ knights): 2 points</li>
        <li>Victory Point card: 1 hidden point</li>
      </ul>
      <h3>Setup</h3>
      <p>
        Everyone places a settlement and a road, then again in reverse order. Your second settlement gives you one card from each
        neighbouring land.
      </p>
      <h3>Your turn</h3>
      <ol>
        <li>Roll the dice. Every land with that number produces for adjacent settlements (1) and cities (2) — for all players.</li>
        <li>Trade with players or the bank (4:1, or 3:1 / 2:1 at harbors).</li>
        <li>Build and buy development cards, then end your turn.</li>
      </ol>
      <h3>Costs</h3>
      <ul>
        <li>Road: 🪵 🧱</li>
        <li>Settlement: 🪵 🧱 🐑 🌾</li>
        <li>City: 🌾🌾 🪨🪨🪨</li>
        <li>Development card: 🐑 🌾 🪨</li>
      </ul>
      <h3>Rolling a 7</h3>
      <p>
        Nobody produces. Anyone holding more than 7 cards discards half (rounded down). Then the roller moves the robber to a new
        land — it blocks production there — and steals a random card from a player next to it.
      </p>
      <h3>Placement rules</h3>
      <ul>
        <li>Settlements need at least two road-lengths of space from every other settlement or city.</li>
        <li>New roads and settlements must connect to your own roads.</li>
        <li>You cannot build a road through an opponent's settlement.</li>
      </ul>
      <h3>Development cards</h3>
      <p>Play at most one per turn, never on the turn you bought it. Victory Point cards count automatically.</p>
      <h3>Tips</h3>
      <p>Pinch to zoom, drag to pan, double-tap to reset. Tap a land to see what it is.</p>
    </div>
  );
}
