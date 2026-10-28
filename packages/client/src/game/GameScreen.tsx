import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  RESOURCES,
  modFor,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  TERRAIN_RESOURCE,
  type Action,
  type ResMap,
  type Resource,
} from '@hex/engine';
import { emit, leaveGame, rejoinLink, sendAction, type RoomSnapshot } from '../net';
import { canVibrate, getVolume, setVibrationEnabled, setVolume, sfx, vibrationEnabled } from '../sound';
import { errorText, getLang, logText, setLang, t, terrainName, type Lang } from '../i18n';
import { HelpContent } from '../screens/Help';
import { Board, hexCenter, type BoardApi, type BoardTargets, type Selection } from './Board';
import { useGameFx } from './fx';
import { getBoardMode, saveBoardMode, webglAvailable, type BoardMode } from './boardMode';

// If the game was updated while this page was open, the old 3D file is gone:
// reload once to get the new version instead of leaving a blank screen.
const Board3D = lazy(() =>
  import('./Board3D').catch((err) => {
    try {
      if (!sessionStorage.getItem('hex-reloaded')) {
        sessionStorage.setItem('hex-reloaded', '1');
        location.reload();
        return new Promise<never>(() => {});
      }
    } catch {
      /* ignore */
    }
    throw err;
  }),
);
import {
  BuildSheet,
  DevSheet,
  DiscardSheet,
  IncomingTrade,
  OrderRollPanel,
  PlayerStrip,
  ResList,
  ResourceBar,
  Sheet,
  StealSheet,
  TradeSheet,
  playerName,
  type BuildMode,
} from './Panels';

type SheetName = 'build' | 'trade' | 'dev' | 'log' | 'menu' | 'help' | 'exit' | null;

function Die({ value, rolling, tone }: { value: number; rolling: boolean; tone: 'red' | 'yellow' }) {
  const spots: Record<number, Array<[number, number]>> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
  };
  return (
    <svg viewBox="0 0 100 100" className={`die ${rolling ? 'rolling' : ''}`}>
      <defs>
        <linearGradient id={`die-${tone}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone === 'red' ? '#ef5a43' : '#ffe27a'} />
          <stop offset="100%" stopColor={tone === 'red' ? '#a51f12' : '#e0a91c'} />
        </linearGradient>
      </defs>
      <rect x="9" y="11" width="86" height="86" rx="20" fill="rgba(0,0,0,0.3)" />
      <rect x="5" y="5" width="86" height="86" rx="20" fill={`url(#die-${tone})`} stroke={tone === 'red' ? '#6e140b' : '#9a6f0c'} strokeWidth="3" />
      <rect x="14" y="10" width="60" height="14" rx="7" fill="rgba(255,255,255,0.28)" />
      {spots[value].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x - 2} cy={y - 2} r="8.6" fill={tone === 'red' ? '#fff6e6' : '#c0281c'} />
          <circle cx={x - 3.5} cy={y - 4} r="2.6" fill="rgba(255,255,255,0.45)" />
        </g>
      ))}
    </svg>
  );
}

export function GameScreen({ snapshot, onLang }: { snapshot: RoomSnapshot; onLang: (l: Lang) => void }) {
  // Phone status/navigation bars follow theme-color: sea blue in game, warm sunset elsewhere.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', '#0e3b5c');
    return () => meta?.setAttribute('content', '#9b3b26');
  }, []);
  const view = snapshot.game!;
  const me = view.me!;
  const myTurn = view.currentPlayer === me && view.phase !== 'GAME_OVER' && view.phase !== 'ORDER_ROLL';
  const myRes = view.players[me].resources!;
  const names = view.players.map((_, i) => playerName(view, i));
  const [mode, setMode] = useState<BuildMode | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dice, setDice] = useState<{ faces: [number, number]; rolling: boolean; sum: number; sumOnly?: boolean } | null>(null);
  const [highlight, setHighlight] = useState<number[]>([]);
  const [flash, setFlash] = useState<Partial<ResMap>>({});
  const [inspect, setInspect] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>(getBoardMode);

  // Cards that fly from producing lands to each player's hand.
  const boardApi = useRef<BoardApi | null>(null);
  const fx = useGameFx(view, names, boardApi);
  const [flights, setFlights] = useState<Array<{ id: number; r: Resource; x: number; y: number; dx: number; dy: number; delay: number }>>([]);
  const flightId = useRef(0);
  const launchFlights = (hexes: number[], gains: ResMap[]) => {
    const api = boardApi.current;
    if (!api || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const toScreen = (hex: number) => {
      const c = hexCenter(view.board, hex);
      return api.project(c.x, c.y) ?? { x: 0, y: 0 };
    };
    const center = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const next: typeof flights = [];
    let k = 0;
    gains.forEach((g, player) => {
      for (const r of RESOURCES) {
        if (!g[r]) continue;
        const hex = hexes.find((h) => TERRAIN_RESOURCE[view.board.hexes[h].terrain] === r);
        if (hex === undefined) continue;
        const from = toScreen(hex);
        const target =
          player === me
            ? center(document.querySelector(`.hand-slot[data-res="${r}"]`))
            : center(document.querySelector(`.player-chip[data-player="${player}"]`));
        if (!target) continue;
        for (let n = 0; n < Math.min(g[r], 3); n++) {
          next.push({ id: ++flightId.current, r, x: from.x, y: from.y, dx: target.x - from.x, dy: target.y - from.y, delay: k++ * 90 });
        }
      }
    });
    if (!next.length) return;
    setFlights((cur) => [...cur, ...next]);
    const ids = new Set(next.map((f) => f.id));
    setTimeout(() => setFlights((cur) => cur.filter((f) => !ids.has(f.id))), 1400 + k * 90);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2800);
  };

  const dispatch = async (action: Action): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    let res;
    try {
      res = await sendAction(snapshot, action);
    } finally {
      setBusy(false);
    }
    if (!res.ok) {
      sfx.error();
      showToast(errorText(res.error));
      return false;
    }
    return true;
  };

  useEffect(() => {
    setSelection(null);
    if (view.phase !== 'MAIN_ACTIONS' || !myTurn) setMode(null);
  }, [view.phase, view.currentPlayer, view.freeRoads, myTurn]);


  // Dice animation + production highlight, triggered by a new roll id.
  const lastRollId = useRef(view.lastRoll?.id ?? 0);
  useEffect(() => {
    const roll = view.lastRoll;
    if (!roll || roll.id === lastRollId.current) return;
    lastRollId.current = roll.id;
    const sum = roll.dice[0] + roll.dice[1];
    const settle = (sumOnly: boolean) => {
      setDice({ faces: roll.dice, rolling: false, sum, sumOnly });
      setHighlight(roll.producingHexes);
      const gain = roll.gains[me];
      if (gain && RESOURCES.some((r) => gain[r] > 0)) {
        sfx.gain(RESOURCES.reduce((n, r) => n + gain[r], 0));
        setFlash(gain);
      }
      launchFlights(roll.producingHexes, roll.gains);
      if (sum === 7) sfx.robber();
      setTimeout(() => setDice(null), 1500);
      setTimeout(() => {
        setHighlight([]);
        setFlash({});
      }, 2600);
    };
    // 3D board: real dice thrown on the table.
    const throwDice = boardApi.current?.rollDice;
    if (throwDice && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let cancelled = false;
      throwDice(roll.dice).then(() => !cancelled && settle(true));
      return () => {
        cancelled = true;
      };
    }
    sfx.dice();
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      setDice({ faces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], rolling: true, sum: 0 });
      if (ticks >= 8) {
        clearInterval(timer);
        settle(false);
      }
    }, 70);
    return () => clearInterval(timer);
  }, [view.lastRoll?.id]);

  const [showOrderResult, setShowOrderResult] = useState(false);
  const prevPhase = useRef(view.phase);
  useEffect(() => {
    if (prevPhase.current === 'ORDER_ROLL' && view.phase !== 'ORDER_ROLL') setShowOrderResult(true);
    if (view.phase !== 'INITIAL_PLACEMENT') setShowOrderResult(false);
    prevPhase.current = view.phase;
  }, [view.phase]);

  const orderRolls = view.orderRoll?.history.length ?? 0;
  const prevOrderRolls = useRef(orderRolls);
  useEffect(() => {
    if (orderRolls > prevOrderRolls.current) sfx.dice();
    prevOrderRolls.current = orderRolls;
  }, [orderRolls]);

  useEffect(() => {
    if (view.phase === 'GAME_OVER') sfx.win();
  }, [view.phase]);

  const targets: BoardTargets = useMemo(() => {
    if (!myTurn) return {};
    if (view.phase === 'INITIAL_PLACEMENT') {
      const last = view.setup?.lastSettlement;
      return last ? { edges: legalSetupRoads(view, last) } : { vertices: legalSetupSettlements(view) };
    }
    if (view.phase === 'ROBBER_MOVE') {
      return { hexes: view.board.hexes.map((h) => h.id).filter((h) => h !== view.board.robberHex) };
    }
    if (view.freeRoads > 0) return { edges: legalRoads(view, me) };
    if (view.phase === 'MAIN_ACTIONS') {
      if (mode === 'road') return { edges: legalRoads(view, me) };
      if (mode === 'settlement') return { vertices: legalSettlements(view, me) };
      if (mode === 'city') return { vertices: legalCities(view, me) };
    }
    return {};
  }, [view, myTurn, mode, me]);

  const confirmFor = (sel: Selection): { label: ReactNode; action: Action } | null => {
    if (!sel) return null;
    const costs = modFor(view).costs;
    if (view.phase === 'INITIAL_PLACEMENT') {
      if (sel.kind === 'vertex') return { label: t('confirmSetupSettlement'), action: { type: 'placeSetupSettlement', vertex: sel.id } };
      if (sel.kind === 'edge') return { label: t('confirmSetupRoad'), action: { type: 'placeSetupRoad', edge: sel.id } };
    }
    if (view.phase === 'ROBBER_MOVE' && sel.kind === 'hex') {
      return {
        label: t('confirmRobber', { terrain: terrainName(view.board.hexes[sel.id].terrain) }),
        action: { type: 'moveRobber', hex: sel.id },
      };
    }
    if (view.freeRoads > 0 && sel.kind === 'edge') return { label: t('confirmFreeRoad'), action: { type: 'placeFreeRoad', edge: sel.id } };
    if (mode === 'road' && sel.kind === 'edge') {
      return { label: <>{t('confirmRoad')} <ResList res={costs.road} />?</>, action: { type: 'buildRoad', edge: sel.id } };
    }
    if (mode === 'settlement' && sel.kind === 'vertex') {
      return { label: <>{t('confirmSettlement')} <ResList res={costs.settlement} />?</>, action: { type: 'buildSettlement', vertex: sel.id } };
    }
    if (mode === 'city' && sel.kind === 'vertex') {
      return { label: <>{t('confirmCity')} <ResList res={costs.city} />?</>, action: { type: 'buildCity', vertex: sel.id } };
    }
    return null;
  };
  const confirm = confirmFor(selection);
  const boardProps = {
    view,
    targets,
    selection,
    onSelect: setSelection,
    highlightHexes: highlight,
    onInspectHex: setInspect,
    apiRef: boardApi,
  };

  const currentName = names[view.currentPlayer];
  const pendingDiscard = view.pendingDiscards[me];
  const hint = (() => {
    if (view.phase === 'GAME_OVER') return t('hintGameOver');
    if (view.phase === 'ORDER_ROLL') return t('hintOrderRoll');
    if (!myTurn) {
      if (view.phase === 'ROBBER_DISCARD') return pendingDiscard ? t('hintDiscard', { n: pendingDiscard }) : t('hintWaitDiscards');
      if (view.phase === 'INITIAL_PLACEMENT') return t('hintPlacing', { name: currentName });
      if (view.paired && view.phase === 'MAIN_ACTIONS') return t('pairedBanner', { name: currentName });
      return t('hintTheirTurn', { name: currentName });
    }
    switch (view.phase) {
      case 'INITIAL_PLACEMENT':
        return view.setup?.lastSettlement ? t('hintPlaceRoad') : t('hintPlaceSettlement');
      case 'PRE_ROLL':
        return t('hintRoll');
      case 'ROBBER_DISCARD':
        return pendingDiscard ? t('hintDiscard', { n: pendingDiscard }) : t('hintWaitDiscards');
      case 'ROBBER_MOVE':
        return t('hintMoveRobber');
      case 'ROBBER_STEAL':
        return t('hintSteal');
      default:
        if (view.freeRoads > 0) return t('hintFreeRoads', { n: view.freeRoads });
        if (mode) return t('hintBuildMode');
        return view.paired ? t('pairedBannerMe') : t('hintMain');
    }
  })();

  const incoming = view.trade && view.trade.to.includes(me) && view.trade.responses[me] === 'pending' && view.phase === 'MAIN_ACTIONS';
  const tradeAnswered = view.trade && view.trade.to.includes(me) && ['accepted', 'countered'].includes(view.trade.responses[me]);
  const lastLog = view.log[view.log.length - 1];

  return (
    <div className={`game ${myTurn ? 'my-turn' : ''}`}>
      <PlayerStrip view={view} seats={snapshot.seats} />

      <div className="board-wrap">
        {boardMode === '3d' ? (
          <Suspense fallback={<Board {...boardProps} />}>
            <Board3D {...boardProps} />
          </Suspense>
        ) : (
          <Board {...boardProps} />
        )}
        <button className="icon-btn menu-btn" onClick={() => setSheet('menu')} aria-label={t('settings')}>
          ☰
        </button>
        {lastLog && (
          <button className="log-ticker" onClick={() => setSheet('log')}>
            {logText(lastLog, names)}
          </button>
        )}
        {inspect !== null && (
          <div className="inspect" onClick={() => setInspect(null)}>
            {terrainName(view.board.hexes[inspect].terrain)}
            {view.board.hexes[inspect].number ? ` · ${view.board.hexes[inspect].number}` : ''}
            {view.board.robberHex === inspect ? ` · ${t('robberHere')}` : ''}
          </div>
        )}
        {dice && (
          <div className={`dice-overlay ${dice.rolling ? 'rolling' : ''} ${dice.sumOnly ? 'sum-only' : ''}`}>
            {!dice.sumOnly && <Die value={dice.faces[0]} rolling={dice.rolling} tone="red" />}
            {!dice.sumOnly && <Die value={dice.faces[1]} rolling={dice.rolling} tone="yellow" />}
            {!dice.rolling && <span className={`dice-sum ${dice.sum === 7 ? 'seven' : ''}`}>{dice.sum}</span>}
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
      {fx}
      {flights.map((f) => (
        <img
          key={f.id}
          className="flying-card"
          src={`/art/card-${f.r}.webp`}
          alt=""
          style={{ left: f.x, top: f.y, animationDelay: `${f.delay}ms`, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px` }}
        />
      ))}

      <div className="bottom">
        <div className={`hint ${myTurn ? 'mine' : ''}`}>
          {hint}
          {tradeAnswered && <span className="muted"> · {t('hintWaitTrade', { name: currentName })}</span>}
        </div>
        {confirm ? (
          <div className="confirm-bar">
            <span>{confirm.label}</span>
            <div className="row">
              <button className="btn ghost" onClick={() => setSelection(null)}>
                {t('cancel')}
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  if (await dispatch(confirm.action)) {
                    setSelection(null);
                    if (confirm.action.type.startsWith('build')) setMode(null);
                  }
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ResourceBar res={myRes} flash={flash} />
            <div className="actions">
              {mode ? (
                <button className="btn wide" onClick={() => setMode(null)}>
                  {t('cancelBuild')}
                </button>
              ) : view.freeRoads > 0 && myTurn ? (
                <button className="btn wide" onClick={() => dispatch({ type: 'finishRoadBuilding' })}>
                  {t('skipFreeRoads')}
                </button>
              ) : (
                <>
                  <button className="btn action" onClick={() => setSheet('build')}>
                    🔨<span>{t('build')}</span>
                  </button>
                  <button className="btn action" onClick={() => setSheet('trade')}>
                    🤝<span>{t('trade')}</span>
                  </button>
                  <button className="btn action" data-fx="dev" onClick={() => setSheet('dev')}>
                    📜<span>
                      {t('cards')} ({view.players[me].devCardCount})
                    </span>
                  </button>
                  {myTurn && view.phase === 'PRE_ROLL' ? (
                    <button className="btn primary big pulse" disabled={busy} onClick={() => dispatch({ type: 'rollDice' })}>
                      🎲 {t('roll')}
                    </button>
                  ) : (
                    <button
                      className="btn primary big"
                      disabled={!myTurn || view.phase !== 'MAIN_ACTIONS' || busy}
                      onClick={() => dispatch({ type: 'endTurn' })}
                    >
                      {t('endTurn')}
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {sheet === 'build' && <BuildSheet view={view} onClose={() => setSheet(null)} onMode={setMode} dispatch={dispatch} />}
      {sheet === 'trade' && <TradeSheet view={view} onClose={() => setSheet(null)} dispatch={dispatch} />}
      {sheet === 'dev' && <DevSheet view={view} onClose={() => setSheet(null)} dispatch={dispatch} />}
      {sheet === 'log' && (
        <Sheet title={t('gameLog')} onClose={() => setSheet(null)}>
          <ol className="log-list">
            {[...view.log].reverse().map((l, i) => (
              <li key={i}>{logText(l, names)}</li>
            ))}
          </ol>
        </Sheet>
      )}
      {sheet === 'menu' && (
        <MenuSheet
          roomId={snapshot.id}
          onClose={() => setSheet(null)}
          onHelp={() => setSheet('help')}
          onLang={onLang}
          onExit={() => setSheet('exit')}
          boardMode={boardMode}
          onBoardMode={(m) => {
            saveBoardMode(m);
            setBoardMode(m);
          }}
        />
      )}
      {sheet === 'exit' && <ExitConfirm roomId={snapshot.id} onCancel={() => setSheet(null)} />}
      {sheet === 'help' && (
        <Sheet title={t('rules')} onClose={() => setSheet(null)}>
          <HelpContent />
        </Sheet>
      )}

      {(view.phase === 'ORDER_ROLL' || showOrderResult) && view.orderRoll && (
        <OrderRollPanel view={view} dispatch={dispatch} onClose={() => setShowOrderResult(false)} />
      )}
      {pendingDiscard !== undefined && view.phase === 'ROBBER_DISCARD' && <DiscardSheet view={view} required={pendingDiscard} dispatch={dispatch} />}
      {myTurn && view.phase === 'ROBBER_STEAL' && <StealSheet view={view} dispatch={dispatch} />}
      {incoming && <IncomingTrade view={view} dispatch={dispatch} />}

      {view.winner !== null && (
        <div className="victory">
          <div className="victory-card">
            <div className="confetti" />
            <h1>{view.winner === me ? t('youWin') : t('theyWin', { name: names[view.winner] })}</h1>
            <ol className="scores">
              {view.players
                .map((p, i) => ({ p, i }))
                .sort((a, b) => b.p.victoryPoints - a.p.victoryPoints)
                .map(({ p, i }) => {
                  const vpCards = p.devCards?.filter((c) => c.type === 'victoryPoint').length ?? 0;
                  return (
                    <li key={i}>
                      <span className="dot" style={{ background: p.color }} /> {names[i]}
                      <b>{t('pts', { n: p.victoryPoints })}</b>
                      {vpCards > 0 && <span className="muted">{t('vpCards', { n: vpCards })}</span>}
                    </li>
                  );
                })}
            </ol>
            <div className="row">
              <button
                className="btn ghost"
                onClick={async () => {
                  await leaveGame(snapshot.id);
                  location.href = '/';
                }}
              >
                {t('exitGame')}
              </button>
              {me === 0 ? (
                <button
                  className="btn primary"
                  onClick={async () => {
                    const r = await emit('room:rematch');
                    if (!r.ok) showToast(errorText(r.error));
                  }}
                >
                  {t('rematch')}
                </button>
              ) : (
                <span className="muted">{t('waitRematch')}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LanguagePicker({ onLang }: { onLang: (l: Lang) => void }) {
  const lang = getLang();
  return (
    <div className="seg">
      <span>{t('language')}</span>
      <div className="seg-buttons">
        {(['he', 'en'] as const).map((l) => (
          <button
            key={l}
            className={lang === l ? 'on' : ''}
            onClick={() => {
              setLang(l);
              onLang(l);
            }}
          >
            {l === 'he' ? 'עברית' : 'English'}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuSheet({
  roomId,
  onClose,
  onHelp,
  onLang,
  onExit,
  boardMode,
  onBoardMode,
}: {
  roomId: string;
  onClose: () => void;
  onHelp: () => void;
  onLang: (l: Lang) => void;
  onExit: () => void;
  boardMode: BoardMode;
  onBoardMode: (m: BoardMode) => void;
}) {
  const [vol, setVol] = useState(() => Math.round(getVolume() * 100));
  const [vibrate, setVibrate] = useState(vibrationEnabled());
  const [copied, setCopied] = useState(false);
  const link = rejoinLink(roomId);
  return (
    <Sheet title={t('settings')} onClose={onClose}>
      <LanguagePicker onLang={onLang} />
      {webglAvailable() && (
        <div className="seg">
          <span>{t('boardView')}</span>
          <div className="seg-buttons">
            {(['3d', '2d'] as const).map((m) => (
              <button key={m} className={boardMode === m ? 'on' : ''} onClick={() => onBoardMode(m)}>
                {m === '3d' ? t('view3d') : t('view2d')}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="volume">
        <span>
          {vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊'} {t('volume')}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={vol}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            setVolume(v / 100);
          }}
          onPointerUp={() => sfx.card()}
        />
      </label>
      {canVibrate() && (
        <label className="check big">
          <input
            type="checkbox"
            checked={vibrate}
            onChange={(e) => {
              setVibrate(e.target.checked);
              setVibrationEnabled(e.target.checked);
            }}
          />
          {t('vibration')}
        </label>
      )}
      <button className="btn wide" onClick={onHelp}>
        📖 {t('rules')}
      </button>
      {link && (
        <div className="rejoin">
          <p className="muted">{t('rejoin')}</p>
          <button
            className="btn wide"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                prompt('', link);
              }
            }}
          >
            {copied ? t('copied') : t('copyRejoin')}
          </button>
        </div>
      )}
      <button className="btn danger wide" onClick={onExit}>
        {t('exitGame')}
      </button>
    </Sheet>
  );
}

/** Asks before leaving: leaving closes and deletes the game for everyone. */
export function ExitConfirm({ roomId, onCancel }: { roomId: string; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={t('exitTitle')} onClose={onCancel}>
      <p className="hint-text">{t('exitText')}</p>
      <div className="row">
        <button className="btn ghost" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await leaveGame(roomId);
            location.href = '/';
          }}
        >
          {t('exitConfirm')}
        </button>
      </div>
    </Sheet>
  );
}
