import { useEffect, useMemo, useRef, useState } from 'react';
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
import { TERRAIN_LABEL, t } from '../strings';
import { HelpContent } from '../screens/Help';
import { Board, type BoardTargets, type Selection } from './Board';
import {
  BuildSheet,
  DevSheet,
  DiscardSheet,
  IncomingTrade,
  PlayerStrip,
  ResList,
  ResourceBar,
  Sheet,
  StealSheet,
  TradeSheet,
  type BuildMode,
} from './Panels';

type SheetName = 'build' | 'trade' | 'dev' | 'log' | 'menu' | 'help' | null;

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function GameScreen({ snapshot }: { snapshot: RoomSnapshot }) {
  const view = snapshot.game!;
  const me = view.me!;
  const myTurn = view.currentPlayer === me && view.phase !== 'GAME_OVER';
  const myRes = view.players[me].resources!;
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
      showToast(res.error);
      return false;
    }
    if (/build|place|buy/.test(action.type)) sfx.build();
    if (action.type === 'moveRobber') sfx.robber();
    return true;
  };

  // Reset local interaction state when the phase or turn changes.
  useEffect(() => {
    setSelection(null);
    if (view.phase !== 'MAIN_ACTIONS' || !myTurn) setMode(null);
  }, [view.phase, view.currentPlayer, view.freeRoads, myTurn]);

  // Turn chime.
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
        setTimeout(() => setDice(null), 1400);
        setTimeout(() => {
          setHighlight([]);
          setFlash({});
        }, 2600);
      }
    }, 70);
    return () => clearInterval(timer);
  }, [view.lastRoll?.id]);

  // Victory sound.
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

  const confirmFor = (sel: Selection): { label: React.ReactNode; action: Action } | null => {
    if (!sel) return null;
    if (view.phase === 'INITIAL_PLACEMENT') {
      if (sel.kind === 'vertex') return { label: 'Place settlement here?', action: { type: 'placeSetupSettlement', vertex: sel.id } };
      if (sel.kind === 'edge') return { label: 'Place road here?', action: { type: 'placeSetupRoad', edge: sel.id } };
    }
    if (view.phase === 'ROBBER_MOVE' && sel.kind === 'hex') {
      return { label: `Move the robber to this ${TERRAIN_LABEL[view.board.hexes[sel.id].terrain].toLowerCase()}?`, action: { type: 'moveRobber', hex: sel.id } };
    }
    if (view.freeRoads > 0 && sel.kind === 'edge') return { label: 'Place a free road here?', action: { type: 'placeFreeRoad', edge: sel.id } };
    if (mode === 'road' && sel.kind === 'edge') {
      return { label: <>Build road for <ResList res={COSTS.road} />?</>, action: { type: 'buildRoad', edge: sel.id } };
    }
    if (mode === 'settlement' && sel.kind === 'vertex') {
      return { label: <>Build settlement for <ResList res={COSTS.settlement} />?</>, action: { type: 'buildSettlement', vertex: sel.id } };
    }
    if (mode === 'city' && sel.kind === 'vertex') {
      return { label: <>Upgrade to city for <ResList res={COSTS.city} />?</>, action: { type: 'buildCity', vertex: sel.id } };
    }
    return null;
  };
  const confirm = confirmFor(selection);

  const current = view.players[view.currentPlayer];
  const pendingDiscard = view.pendingDiscards[me];
  const hint = (() => {
    if (view.phase === 'GAME_OVER') return 'Game over';
    if (!myTurn) {
      if (view.phase === 'ROBBER_DISCARD') return pendingDiscard ? `Discard ${pendingDiscard} cards` : 'Waiting for players to discard…';
      if (view.phase === 'INITIAL_PLACEMENT') return `${current.name} is placing…`;
      return `${current.name}'s turn`;
    }
    switch (view.phase) {
      case 'INITIAL_PLACEMENT':
        return view.setup?.lastSettlement ? 'Place a road next to your settlement' : 'Tap a spot to place a settlement';
      case 'PRE_ROLL':
        return 'Your turn — roll the dice';
      case 'ROBBER_DISCARD':
        return pendingDiscard ? `Discard ${pendingDiscard} cards` : 'Waiting for players to discard…';
      case 'ROBBER_MOVE':
        return 'Move the robber: tap a hex';
      case 'ROBBER_STEAL':
        return 'Choose who to steal from';
      default:
        if (view.freeRoads > 0) return `Place ${view.freeRoads} free road${view.freeRoads > 1 ? 's' : ''}`;
        if (mode) return `Tap a highlighted spot to build a ${mode}`;
        return 'Build, trade, or end your turn';
    }
  })();

  const incoming =
    view.trade && view.trade.to.includes(me) && view.trade.responses[me] === 'pending' && view.phase === 'MAIN_ACTIONS';
  const tradeAnswered =
    view.trade && view.trade.to.includes(me) && ['accepted', 'countered'].includes(view.trade.responses[me]);

  const winner = view.winner !== null ? view.players[view.winner] : null;

  return (
    <div className={`game ${myTurn ? 'my-turn' : ''}`}>
      <PlayerStrip view={view} seats={snapshot.seats} />

      <div className="board-wrap">
        <Board
          view={view}
          targets={targets}
          selection={selection}
          onSelect={setSelection}
          highlightHexes={highlight}
          onInspectHex={setInspect}
        />
        <button className="icon-btn menu-btn" onClick={() => setSheet('menu')} aria-label={t.settings}>
          ☰
        </button>
        <button className="log-ticker" onClick={() => setSheet('log')}>
          {view.log[view.log.length - 1]}
        </button>
        {inspect !== null && (
          <div className="inspect" onClick={() => setInspect(null)}>
            {TERRAIN_LABEL[view.board.hexes[inspect].terrain]}
            {view.board.hexes[inspect].number ? ` · ${view.board.hexes[inspect].number}` : ''}
            {view.board.robberHex === inspect ? ' · robber' : ''}
          </div>
        )}
        {dice && (
          <div className={`dice-overlay ${dice.rolling ? 'rolling' : ''}`}>
            <span className="die">{DIE_FACES[dice.faces[0]]}</span>
            <span className="die">{DIE_FACES[dice.faces[1]]}</span>
            {!dice.rolling && <span className={`dice-sum ${dice.sum === 7 ? 'seven' : ''}`}>{dice.sum}</span>}
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>

      <div className="bottom">
        <div className={`hint ${myTurn ? 'mine' : ''}`}>
          {hint}
          {tradeAnswered && <span className="muted"> · waiting for {current.name} to finish the trade</span>}
        </div>
        {confirm ? (
          <div className="confirm-bar">
            <span>{confirm.label}</span>
            <div className="row">
              <button className="btn ghost" onClick={() => setSelection(null)}>
                {t.cancel}
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
                {t.confirm}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ResourceBar res={myRes} flash={flash} />
            <div className="actions">
              {mode ? (
                <button className="btn wide" onClick={() => setMode(null)}>
                  {t.cancel} build
                </button>
              ) : view.freeRoads > 0 && myTurn ? (
                <button className="btn wide" onClick={() => dispatch({ type: 'finishRoadBuilding' })}>
                  Skip remaining free roads
                </button>
              ) : (
                <>
                  <button className="btn action" onClick={() => setSheet('build')}>
                    🔨<span>{t.build}</span>
                  </button>
                  <button className="btn action" onClick={() => setSheet('trade')}>
                    🤝<span>{t.trade}</span>
                  </button>
                  <button className="btn action" onClick={() => setSheet('dev')}>
                    📜<span>
                      {t.cards} ({view.players[me].devCardCount})
                    </span>
                  </button>
                  {myTurn && view.phase === 'PRE_ROLL' ? (
                    <button className="btn primary big pulse" disabled={busy} onClick={() => dispatch({ type: 'rollDice' })}>
                      🎲 {t.roll}
                    </button>
                  ) : (
                    <button
                      className="btn primary big"
                      disabled={!myTurn || view.phase !== 'MAIN_ACTIONS' || busy}
                      onClick={() => dispatch({ type: 'endTurn' })}
                    >
                      {t.endTurn}
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
        <Sheet title="Game log" onClose={() => setSheet(null)}>
          <ol className="log-list">
            {[...view.log].reverse().map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </Sheet>
      )}
      {sheet === 'menu' && <MenuSheet roomId={snapshot.id} onClose={() => setSheet(null)} onHelp={() => setSheet('help')} />}
      {sheet === 'help' && (
        <Sheet title={t.rules} onClose={() => setSheet(null)}>
          <HelpContent />
        </Sheet>
      )}

      {pendingDiscard !== undefined && view.phase === 'ROBBER_DISCARD' && (
        <DiscardSheet view={view} required={pendingDiscard} dispatch={dispatch} />
      )}
      {myTurn && view.phase === 'ROBBER_STEAL' && <StealSheet view={view} dispatch={dispatch} />}
      {incoming && <IncomingTrade view={view} dispatch={dispatch} />}

      {winner && (
        <div className="victory">
          <div className="victory-card">
            <div className="confetti" />
            <h1>{view.winner === me ? 'You win! 🎉' : `${winner.name} wins!`}</h1>
            <ol className="scores">
              {view.players
                .map((p, i) => ({ p, i }))
                .sort((a, b) => b.p.victoryPoints - a.p.victoryPoints)
                .map(({ p, i }) => (
                  <li key={i}>
                    <span className="dot" style={{ background: p.color }} /> {p.name}
                    <b>{p.victoryPoints} pts</b>
                    <span className="muted">
                      {p.devCards?.filter((c) => c.type === 'victoryPoint').length
                        ? ` (${p.devCards.filter((c) => c.type === 'victoryPoint').length} VP cards)`
                        : ''}
                    </span>
                  </li>
                ))}
            </ol>
            <div className="row">
              <button className="btn ghost" onClick={() => (location.href = '/')}>
                {t.home}
              </button>
              {me === 0 ? (
                <button
                  className="btn primary"
                  onClick={async () => {
                    const r = await emit('room:rematch');
                    if (!r.ok) showToast(r.error);
                  }}
                >
                  {t.rematch}
                </button>
              ) : (
                <span className="muted">Waiting for the host to start a rematch…</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuSheet({ roomId, onClose, onHelp }: { roomId: string; onClose: () => void; onHelp: () => void }) {
  const [sound, setSound] = useState(soundEnabled());
  const [copied, setCopied] = useState(false);
  const link = rejoinLink(roomId);
  return (
    <Sheet title={t.settings} onClose={onClose}>
      <label className="check big">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => {
            setSound(e.target.checked);
            setSoundEnabled(e.target.checked);
          }}
        />
        {t.sound}
      </label>
      <button className="btn wide" onClick={onHelp}>
        📖 {t.rules}
      </button>
      {link && (
        <div className="rejoin">
          <p className="muted">{t.rejoin}</p>
          <button
            className="btn wide"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                prompt('Copy this link', link);
              }
            }}
          >
            {copied ? t.copied : 'Copy rejoin link'}
          </button>
        </div>
      )}
      <button className="btn ghost wide" onClick={() => (location.href = '/')}>
        {t.home}
      </button>
    </Sheet>
  );
}
