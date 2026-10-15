/**
 * Game "juice": turns each new game event into a short animation and sound.
 * Driven only by the public player view (log events and board changes), so
 * every phone animates the same things and nothing hidden is revealed: a
 * stolen card is shown face-up only to the thief and the victim.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { GRAPH, RESOURCES, type DevCardType, type LogItem, type PlayerView, type ResMap, type Resource } from '@hex/engine';
import { DevCardFace } from '../art';
import { devInfo, logText, t } from '../i18n';
import { sfx } from '../sound';
import { S } from './Board';

interface Point {
  x: number;
  y: number;
}

interface Flight {
  id: number;
  img: string;
  from: Point;
  to: Point;
  delay: number;
  big?: boolean;
}

type Banner =
  | { id: number; kind: 'card'; card: DevCardType; caption: string }
  | { id: number; kind: 'award'; img: string; title: string; caption: string }
  | { id: number; kind: 'turn' };

type BannerInput = Banner extends infer B ? (B extends Banner ? Omit<B, 'id'> : never) : never;

interface Puff {
  id: number;
  at: Point;
  big: boolean;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEV_EVENTS: Partial<Record<string, DevCardType>> = {
  playedKnight: 'knight',
  playedRoadBuilding: 'roadBuilding',
  playedYearOfPlenty: 'yearOfPlenty',
  playedMonopoly: 'monopoly',
};

function centerOf(el: Element | null): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function expand(res: Partial<ResMap> | undefined, max = 4): Resource[] {
  const out: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < (res?.[r] ?? 0) && out.length < max; i++) out.push(r);
  return out;
}

export function useGameFx(view: PlayerView, names: string[], boardSvg: MutableRefObject<SVGSVGElement | null>) {
  const me = view.me!;
  const [flights, setFlights] = useState<Flight[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [puffs, setPuffs] = useState<Puff[]>([]);
  const nextId = useRef(0);
  const lastSeq = useRef<number>(Math.max(0, ...view.log.map((l) => l.seq ?? 0)));
  const prevBoard = useRef({ buildings: view.buildings, roads: view.roads });
  const prevTurnKey = useRef(`${view.turn}-${view.currentPlayer}`);

  // --- Screen positions -----------------------------------------------------
  const boardPoint = (x: number, y: number): Point | null => {
    const root = boardSvg.current?.querySelector('.board-root') as SVGGElement | null;
    const m = root?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const bank = (): Point | null => {
    const wrap = document.querySelector('.board-wrap')?.getBoundingClientRect();
    return wrap ? { x: wrap.left + wrap.width / 2, y: wrap.top + 70 } : null;
  };
  const playerAt = (player: number, r?: Resource): Point | null =>
    player === me
      ? centerOf(r ? document.querySelector(`.hand-slot[data-res="${r}"]`) : document.querySelector('.hand'))
      : centerOf(document.querySelector(`.player-chip[data-player="${player}"]`));

  const fly = (img: string, from: Point | null, to: Point | null, delay = 0, big = false) => {
    if (!from || !to || reducedMotion()) return;
    const f: Flight = { id: ++nextId.current, img, from, to, delay, big };
    setFlights((cur) => [...cur, f]);
    setTimeout(() => setFlights((cur) => cur.filter((x) => x.id !== f.id)), 1200 + delay);
  };
  const banner = (b: BannerInput) => setBanners((cur) => [...cur, { ...b, id: ++nextId.current } as Banner]);
  const puff = (at: Point | null, big: boolean) => {
    if (!at || reducedMotion()) return;
    const p = { id: ++nextId.current, at, big };
    setPuffs((cur) => [...cur, p]);
    setTimeout(() => setPuffs((cur) => cur.filter((x) => x.id !== p.id)), 700);
  };

  // --- Log events -------------------------------------------------------------
  useEffect(() => {
    const fresh = view.log.filter((l) => (l.seq ?? 0) > lastSeq.current);
    if (!fresh.length) return;
    lastSeq.current = Math.max(...fresh.map((l) => l.seq ?? 0));
    fresh.forEach((item, i) => handle(item, i * 120));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.log]);

  function handle(item: LogItem, delay: number) {
    const p = item.params ?? {};
    const caption = logText(item, names);
    switch (item.key) {
      case 'steal':
      case 'stealSecret': {
        const known = item.key === 'stealSecret' && p.r ? p.r : undefined;
        fly(known ? `/art/card-${known}.webp` : '/art/back-resource.webp', playerAt(p.q!, known), playerAt(p.p!, known), delay, true);
        if (p.p === me) setTimeout(() => sfx.steal(), delay);
        else if (p.q === me) setTimeout(() => sfx.robbed(), delay);
        else setTimeout(() => sfx.steal(), delay);
        break;
      }
      case 'traded': {
        expand(p.give).forEach((r, k) => fly(`/art/card-${r}.webp`, playerAt(p.p!, r), playerAt(p.q!, r), delay + k * 90));
        expand(p.get).forEach((r, k) => fly(`/art/card-${r}.webp`, playerAt(p.q!, r), playerAt(p.p!, r), delay + 200 + k * 90));
        setTimeout(() => sfx.trade(), delay);
        break;
      }
      case 'bankTrade': {
        for (let k = 0; k < Math.min(p.n ?? 0, 4); k++) fly(`/art/card-${p.r}.webp`, playerAt(p.p!, p.r), bank(), delay + k * 80);
        fly(`/art/card-${p.r2}.webp`, bank(), playerAt(p.p!, p.r2), delay + 450);
        setTimeout(() => sfx.trade(), delay);
        break;
      }
      case 'discarded': {
        for (let k = 0; k < Math.min(p.n ?? 0, 4); k++) fly('/art/back-resource.webp', playerAt(p.p!), bank(), delay + k * 80);
        setTimeout(() => sfx.discard(), delay);
        break;
      }
      case 'boughtDev': {
        const deck = boardPoint(0, 0);
        const to = p.p === me ? centerOf(document.querySelector('[data-fx="dev"]')) : playerAt(p.p!);
        fly('/art/back-dev.webp', deck, to, delay, true);
        setTimeout(() => sfx.devCard(), delay);
        break;
      }
      case 'playedKnight':
      case 'playedRoadBuilding':
      case 'playedYearOfPlenty':
      case 'playedMonopoly': {
        const card = DEV_EVENTS[item.key]!;
        banner({ kind: 'card', card, caption });
        setTimeout(() => sfx.playCard(), delay);
        if (item.key === 'playedYearOfPlenty') {
          expand(p.res).forEach((r, k) => fly(`/art/card-${r}.webp`, bank(), playerAt(p.p!, r), delay + 900 + k * 120));
        }
        if (item.key === 'playedMonopoly' && p.r && (p.n ?? 0) > 0) {
          const others = view.players.map((_, i) => i).filter((i) => i !== p.p);
          for (let k = 0; k < Math.min(p.n!, 6); k++) {
            fly(`/art/card-${p.r}.webp`, playerAt(others[k % others.length]), playerAt(p.p!, p.r), delay + 900 + k * 110);
          }
        }
        break;
      }
      case 'longestRoad':
        banner({ kind: 'award', img: '/art/dev-roadBuilding.webp', title: t('longestRoad'), caption });
        setTimeout(() => sfx.award(), delay);
        break;
      case 'largestArmy':
        banner({ kind: 'award', img: '/art/dev-knight.webp', title: t('largestArmy'), caption });
        setTimeout(() => sfx.award(), delay);
        break;
      case 'robberMoved':
        setTimeout(() => sfx.robber(), delay + 250);
        break;
      default:
        break;
    }
  }

  // --- New pieces: dust puff and the right "clack" ------------------------------
  useEffect(() => {
    const before = prevBoard.current;
    prevBoard.current = { buildings: view.buildings, roads: view.roads };
    let sound: 'build' | 'city' | 'road' | null = null;
    for (const [vertex, b] of Object.entries(view.buildings)) {
      const old = before.buildings[vertex];
      if (old && old.type === b.type) continue;
      const v = GRAPH.vertices[vertex];
      setTimeout(() => puff(boardPoint(v.x * S, v.y * S), b.type === 'city'), 300);
      sound = b.type === 'city' ? 'city' : 'build';
    }
    for (const edge of Object.keys(view.roads)) {
      if (before.roads[edge] !== undefined) continue;
      const e = GRAPH.edges[edge];
      setTimeout(() => puff(boardPoint(e.x * S, e.y * S), false), 300);
      sound ??= 'road';
    }
    if (sound) setTimeout(() => sfx[sound!](), 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.buildings, view.roads]);

  // --- "Your turn" --------------------------------------------------------------
  useEffect(() => {
    const key = `${view.turn}-${view.currentPlayer}`;
    if (key === prevTurnKey.current) return;
    prevTurnKey.current = key;
    if (view.currentPlayer === me && view.phase === 'PRE_ROLL') {
      banner({ kind: 'turn' });
      sfx.turn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.turn, view.currentPlayer, view.phase]);

  // Banners show one at a time.
  const current = banners[0];
  useEffect(() => {
    if (!current) return;
    const ms = current.kind === 'turn' ? 1300 : 2000;
    const timer = setTimeout(() => setBanners((cur) => cur.slice(1)), ms);
    return () => clearTimeout(timer);
  }, [current?.id]);

  return (
    <>
      {flights.map((f) => (
        <img
          key={f.id}
          className={`fx-card ${f.big ? 'big' : ''}`}
          src={f.img}
          alt=""
          style={{
            left: f.from.x,
            top: f.from.y,
            animationDelay: `${f.delay}ms`,
            ['--dx' as string]: `${f.to.x - f.from.x}px`,
            ['--dy' as string]: `${f.to.y - f.from.y}px`,
          }}
        />
      ))}
      {puffs.map((p) => (
        <span key={p.id} className={`fx-puff ${p.big ? 'big' : ''}`} style={{ left: p.at.x, top: p.at.y }}>
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ ['--a' as string]: `${(i / 7) * 360}deg` }} />
          ))}
        </span>
      ))}
      {current && (
        <div className={`fx-banner ${current.kind}`} key={current.id} onClick={() => setBanners((cur) => cur.slice(1))}>
          {current.kind === 'turn' && <div className="fx-turn">{t('yourTurn')}</div>}
          {current.kind === 'card' && (
            <div className="fx-card-show">
              <div className="fx-card-face">
                <DevCardFace type={current.card} title={devInfo(current.card).name} text={devInfo(current.card).text} />
              </div>
              <p>{current.caption}</p>
            </div>
          )}
          {current.kind === 'award' && (
            <div className="fx-award">
              <img src={current.img} alt="" />
              <h3>{current.title}</h3>
              <p>{current.caption}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
