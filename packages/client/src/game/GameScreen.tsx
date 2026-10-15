import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  COSTS,
  RESOURCES,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  type Action,
  type ResMap,
} from '@hex/engine';
import { emit, rejoinLink, sendAction, type RoomSnapshot } from '../net';
import { setSoundEnabled, sfx, soundEnabled } from '../sound';
import { errorText, getLang, logText, setLang, t, terrainName, type Lang } from '../i18n';
import { HelpContent } from '../screens/Help';
import { Board, type BoardTargets, type Selection } from './Board';
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

type SheetName = 'build' | 'trade' | 'dev' | 'log' | 'menu' | 'help' | null;

function Die({ value, rolling }: { value: number; rolling: boolean }) {
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
      <rect x="6" y="6" width="88" height="88" rx="18" fill="#d8392b" stroke="#7e1a10" strokeWidth="4" />
      {spots[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="8.5" fill="#f6e7bf" />
      ))}
    </svg>
  );
}

export function GameScreen({ snapshot, onLang }: { snapshot: RoomSnapshot; onLang: (l: Lang) => void }) {
  const view = snapshot.game!;
  const me = view.me!;
  const myTurn = view.currentPlayer === me && view.phase !== 'GAME_OVER' && view.phase !== 'ORDER_ROLL';
  const myRes = view.players[me].resources!;
  const names = view.players.map((_, i) => playerName(view, i));
  const [mode, setMode] = useState<BuildMode | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dice, setDice] = useState<{ faces: [number, number]; rolling: boolean; sum: number } | null>(null);
  const [highlight, setHighlight] = useState<number[]>([]);
  const [flash, setFlash] = useState<Partial<ResMap>>({});
  const [inspect, setInspect] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2800);
  };

  const dispatch = async (action: Action): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    const res = await sendAction(snapshot, action);
    setBusy(false);
    if (!res.ok) {
      sfx.error();
      showToast(errorText(res.error));
      return false;
    }
    if (/build|place|buy/.test(action.type)) sfx.build();
    if (action.type === 'moveRobber') sfx.robber();
    return true;
  };

  useEffect(() => {
    setSelection(null);
    if (view.phase !== 'MAIN_ACTIONS' || !myTurn) setMode(null);
  }, [view.phase, view.currentPlayer, view.freeRoads, myTurn]);

  const prevPlayer = useRef(view.currentPlayer);
  useEffect(() => {
    if (prevPlayer.current !== view.currentPlayer && myTurn && view.phase === 'PRE_ROLL') sfx.turn();
    prevPlayer.current = view.currentPlayer;
  }, [view.currentPlayer, myTurn, view.phase]);

  // Dice animation + production highlight, triggered by a new roll id.
  const lastRollId = useRef(view.lastRoll?.id ?? 0);
  useEffect(() => {
    const roll = view.lastRoll;
    if (!roll || roll.id === lastRollId.current) return;
    lastRollId.current = roll.id;
    sfx.dice();
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      setDice({ faces: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], rolling: true, sum: 0 });
      if (ticks >= 8) {
        clearInterval(timer);
        const sum = roll.dice[0] + roll.dice[1];
        setDice({ faces: roll.dice, rolling: false, sum });
        setHighlight(roll.producingHexes);
        const gain = roll.gains[me];
        if (gain && RESOURCES.some((r) => gain[r] > 0)) {
          sfx.gain();
          setFlash(gain);
        }
        if (sum === 7) sfx.robber();
        setTimeout(() => setDice(null), 1500);
        setTimeout(() => {
          setHighlight([]);
          setFlash({});
        }, 2600);
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
      return { label: <>{t('confirmRoad')} <ResList res={COSTS.road} />?</>, action: { type: 'buildRoad', edge: sel.id } };
    }
    if (mode === 'settlement' && sel.kind === 'vertex') {
      return { label: <>{t('confirmSettlement')} <ResList res={COSTS.settlement} />?</>, action: { type: 'buildSettlement', vertex: sel.id } };
    }
    if (mode === 'city' && sel.kind === 'vertex') {
      return { label: <>{t('confirmCity')} <ResList res={COSTS.city} />?</>, action: { type: 'buildCity', vertex: sel.id } };
    }
    return null;
  };
  const confirm = confirmFor(selection);

  const currentName = names[view.currentPlayer];
  const pendingDiscard = view.pendingDiscards[me];
  const hint = (() => {
    if (view.phase === 'GAME_OVER') return t('hintGameOver');
    if (view.phase === 'ORDER_ROLL') return t('hintOrderRoll');
    if (!myTurn) {
      if (view.phase === 'ROBBER_DISCARD') return pendingDiscard ? t('hintDiscard', { n: pendingDiscard }) : t('hintWaitDiscards');
      if (view.phase === 'INITIAL_PLACEMENT') return t('hintPlacing', { name: currentName });
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
        return t('hintMain');
    }
  })();

  const incoming = view.trade && view.trade.to.includes(me) && view.trade.responses[me] === 'pending' && view.phase === 'MAIN_ACTIONS';
  const tradeAnswered = view.trade && view.trade.to.includes(me) && ['accepted', 'countered'].includes(view.trade.responses[me]);
  const lastLog = view.log[view.log.length - 1];

  return (
    <div className={`game ${myTurn ? 'my-turn' : ''}`}>
      <PlayerStrip view={view} seats={snapshot.seats} />

      <div className="board-wrap">
        <Board view={view} targets={targets} selection={selection} onSelect={setSelection} highlightHexes={highlight} onInspectHex={setInspect} />
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
          <div className={`dice-overlay ${dice.rolling ? 'rolling' : ''}`}>
            <Die value={dice.faces[0]} rolling={dice.rolling} />
            <Die value={dice.faces[1]} rolling={dice.rolling} />
            {!dice.rolling && <span className={`dice-sum ${dice.sum === 7 ? 'seven' : ''}`}>{dice.sum}</span>}
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>

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
                  <button className="btn action" onClick={() => setSheet('dev')}>
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
      {sheet === 'menu' && <MenuSheet roomId={snapshot.id} onClose={() => setSheet(null)} onHelp={() => setSheet('help')} onLang={onLang} />}
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
              <button className="btn ghost" onClick={() => (location.href = '/')}>
                {t('home')}
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

function MenuSheet({ roomId, onClose, onHelp, onLang }: { roomId: string; onClose: () => void; onHelp: () => void; onLang: (l: Lang) => void }) {
  const [sound, setSound] = useState(soundEnabled());
  const [copied, setCopied] = useState(false);
  const link = rejoinLink(roomId);
  return (
    <Sheet title={t('settings')} onClose={onClose}>
      <LanguagePicker onLang={onLang} />
      <label className="check big">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => {
            setSound(e.target.checked);
            setSoundEnabled(e.target.checked);
          }}
        />
        {t('sound')}
      </label>
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
      <button className="btn ghost wide" onClick={() => (location.href = '/')}>
        {t('home')}
      </button>
    </Sheet>
  );
}
