# Hex Islands

A private online island-settling board game for 2–4 players on mobile.
See `SPEC.md` for rules, decisions and roadmap.

## Requirements
- Node.js 20+

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173 (the dev server proxies to the game server on :3001).
To try it with a phone on the same Wi-Fi, open `http://<your-PC-IP>:5173`.

## Production-style run
```bash
npm run build
npm start
```
Serves everything from http://localhost:3001. Games are saved to `data/rooms/`
(or to Postgres when `DATABASE_URL` is set).

## Tests
```bash
npm test
```

## Fast-forward a live game (dev tool)
```bash
cd packages/server
npx tsx scripts/autoplay.ts http://localhost:3001 <roomId> <untilTurn> <playerToken...>
```
