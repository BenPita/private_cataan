import { useEffect, useState, type ReactNode } from 'react';
import {
  COSTS,
  PIECE_LIMITS,
  RESOURCES,
  emptyRes,
  hasRes,
  legalCities,
  legalRoads,
  legalSettlements,
  totalRes,
  tradeRates,
  type DevCardType,
  type PlayerView,
  type ResMap,
  type Resource,
} from '@hex/engine';
import { DEV_LABEL, RESOURCE_COLOR, RESOURCE_ICON, RESOURCE_LABEL, t } from '../strings';
import type { PublicSeat } from '../net';
import type { Action } from '@hex/engine';

export type Dispatch = (a: Action) => Promise<boolean>;

export function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label={t.close}>
              ✕
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ResChip({ r, n, dim }: { r: Resource; n?: number; dim?: boolean }) {
  return (
    <span className={`res-chip ${dim ? 'dim' : ''}`} style={{ background: RESOURCE_COLOR[r] }}>
      {RESOURCE_ICON[r]}
      {n !== undefined && <b>{n}</b>}
    </span>
  );
}

export function ResList({ res }: { res: Partial<ResMap> }) {
  const items = RESOURCES.filter((r) => (res[r] ?? 0) > 0);
  if (!items.length) return <span className="muted">nothing</span>;
  return (
    <span className="res-list">
      {items.map((r) => (
        <ResChip key={r} r={r} n={res[r]} />
      ))}
    </span>
  );
}

/** +/- counters per resource. */
export function ResCounter({ value, onChange, max }: { value: ResMap; onChange: (v: ResMap) => void; max?: ResMap }) {
  return (
    <div className="res-counter">
      {RESOURCES.map((r) => (
        <div key={r} className="res-counter-row">
          <ResChip r={r} />
          <span className="res-name">{RESOURCE_LABEL[r]}</span>
          <button className="round" disabled={value[r] <= 0} onClick={() => onChange({ ...value, [r]: value[r] - 1 })}>
            −
          </button>
          <b className="count">{value[r]}</b>
          <button
            className="round"
            disabled={max ? value[r] >= max[r] : value[r] >= 19}
            onClick={() => onChange({ ...value, [r]: value[r] + 1 })}
          >
            +
          </button>
        </div>
      ))}
    </div>
  );
}

export function ResourceBar({ res, flash }: { res: ResMap; flash: Partial<ResMap> }) {
  return (
    <div className="resource-bar">
      {RESOURCES.map((r) => (
        <div key={r} className="res-card" style={{ background: RESOURCE_COLOR[r] }} title={RESOURCE_LABEL[r]}>
          <span className="res-icon">{RESOURCE_ICON[r]}</span>
          <b>{res[r]}</b>
          {(flash[r] ?? 0) !== 0 && (
            <span className={`res-flash ${(flash[r] ?? 0) > 0 ? 'up' : 'down'}`}>
              {(flash[r] ?? 0) > 0 ? '+' : ''}
              {flash[r]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function PlayerStrip({ view, seats }: { view: PlayerView; seats: PublicSeat[] }) {
  return (
    <div className="player-strip">
      {view.players.map((p, i) => (
        <div
          key={i}
          className={`player-chip ${view.currentPlayer === i && view.phase !== 'GAME_OVER' ? 'active' : ''}`}
          style={{ borderColor: p.color }}
        >
          <div className="chip-top">
            <span className="dot" style={{ background: p.color }} />
            <span className="pname">
              {p.name}
              {i === view.me ? ` (${t.you})` : ''}
            </span>
            {!seats[i]?.connected && <span className="offline-tag">{t.disconnected}</span>}
          </div>
          <div className="chip-stats">
            <span title="Victory points">⭐ {p.victoryPoints}</span>
            <span title="Resource cards">🂠 {p.resourceCount}</span>
            <span title="Development cards">📜 {p.devCardCount}</span>
            <span title="Knights played">⚔️ {p.knightsPlayed}</span>
          </div>
          <div className="chip-badges">
            {view.longestRoad.holder === i && <span className="badge">🛤️ Road</span>}
            {view.largestArmy === i && <span className="badge">🛡️ Army</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Build ------------------------------------------------------------------

export type BuildMode = 'road' | 'settlement' | 'city';

export function BuildSheet({
  view,
  onClose,
  onMode,
  dispatch,
}: {
  view: PlayerView;
  onClose: () => void;
  onMode: (m: BuildMode) => void;
  dispatch: Dispatch;
}) {
  const me = view.me!;
  const p = view.players[me];
  const res = p.resources!;
  const canAct = view.currentPlayer === me && view.phase === 'MAIN_ACTIONS' && view.freeRoads === 0;
  const [confirmDev, setConfirmDev] = useState(false);

  const items: Array<{ key: BuildMode | 'devCard'; name: string; left: number | string; spots: number; reason: string | null }> = [
    {
      key: 'road',
      name: 'Road',
      left: PIECE_LIMITS.roads - p.roadsBuilt,
      spots: legalRoads(view, me).length,
      reason: null,
    },
    {
      key: 'settlement',
      name: 'Settlement',
      left: PIECE_LIMITS.settlements - (p.settlementsBuilt - p.citiesBuilt),
      spots: legalSettlements(view, me).length,
      reason: null,
    },
    {
      key: 'city',
      name: 'City',
      left: PIECE_LIMITS.cities - p.citiesBuilt,
      spots: legalCities(view, me).length,
      reason: null,
    },
    { key: 'devCard', name: 'Development card', left: `${view.devDeckCount} in deck`, spots: view.devDeckCount, reason: null },
  ];
  for (const it of items) {
    const cost = COSTS[it.key];
    if (!canAct) it.reason = view.currentPlayer !== me ? 'Not your turn' : view.phase === 'PRE_ROLL' ? 'Roll the dice first' : 'Not now';
    else if (typeof it.left === 'number' && it.left <= 0) it.reason = 'No pieces left';
    else if (it.spots === 0) it.reason = it.key === 'devCard' ? 'Deck is empty' : 'No legal spot';
    else if (!hasRes(res, cost)) it.reason = 'Not enough resources';
  }

  return (
    <Sheet title={t.build} onClose={onClose}>
      <div className="build-list">
        {items.map((it) => (
          <button
            key={it.key}
            className="build-item"
            disabled={!!it.reason}
            onClick={() => {
              if (it.key === 'devCard') setConfirmDev(true);
              else {
                onMode(it.key);
                onClose();
              }
            }}
          >
            <div className="build-name">
              <b>{it.name}</b>
              <span className="muted">{typeof it.left === 'number' ? `${it.left} left` : it.left}</span>
            </div>
            <ResList res={COSTS[it.key]} />
            {it.reason && <span className="reason">{it.reason}</span>}
          </button>
        ))}
      </div>
      {confirmDev && (
        <div className="confirm-inline">
          <span>
            Buy a development card for <ResList res={COSTS.devCard} />?
          </span>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmDev(false)}>
              {t.cancel}
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                if (await dispatch({ type: 'buyDevCard' })) onClose();
              }}
            >
              {t.confirm}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// --- Trade ------------------------------------------------------------------

export function TradeSheet({ view, onClose, dispatch }: { view: PlayerView; onClose: () => void; dispatch: Dispatch }) {
  const me = view.me!;
  const res = view.players[me].resources!;
  const [tab, setTab] = useState<'bank' | 'player'>('player');
  const rates = tradeRates(view, me);
  const [give, setGive] = useState<Resource | null>(null);
  const [get, setGet] = useState<Resource | null>(null);
  const [offerGive, setOfferGive] = useState<ResMap>(emptyRes());
  const [offerGet, setOfferGet] = useState<ResMap>(emptyRes());
  const opponents = view.players.map((_, i) => i).filter((i) => i !== me);
  const [to, setTo] = useState<number[]>(opponents);
  const canTrade = view.currentPlayer === me && view.phase === 'MAIN_ACTIONS';
  const trade = view.trade && view.trade.from === me ? view.trade : null;

  if (trade) {
    return (
      <Sheet title="Your offer" onClose={onClose}>
        <div className="offer-summary">
          <div>
            You give <ResList res={trade.give} />
          </div>
          <div>
            You get <ResList res={trade.get} />
          </div>
        </div>
        <div className="responses">
          {trade.to.map((p) => {
            const r = trade.responses[p];
            const counter = trade.counters[p];
            return (
              <div key={p} className="response-row">
                <span className="dot" style={{ background: view.players[p].color }} />
                <b>{view.players[p].name}</b>
                {r === 'pending' && <span className="muted">thinking…</span>}
                {r === 'rejected' && <span className="muted">declined</span>}
                {r === 'accepted' && (
                  <button className="btn primary small" onClick={() => dispatch({ type: 'confirmTrade', tradeId: trade.id, with: p })}>
                    Accept deal
                  </button>
                )}
                {r === 'countered' && counter && (
                  <div className="counter-box">
                    <span>
                      Counter: you give <ResList res={counter.give} /> get <ResList res={counter.get} />
                    </span>
                    <button className="btn primary small" onClick={() => dispatch({ type: 'confirmTrade', tradeId: trade.id, with: p })}>
                      Accept counter
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn ghost wide" onClick={() => dispatch({ type: 'cancelTrade' })}>
          Withdraw offer
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={t.trade} onClose={onClose}>
      <div className="tabs">
        <button className={tab === 'player' ? 'on' : ''} onClick={() => setTab('player')}>
          Players
        </button>
        <button className={tab === 'bank' ? 'on' : ''} onClick={() => setTab('bank')}>
          Bank & harbors
        </button>
      </div>
      {!canTrade && <p className="hint-text">You can trade during your turn, after rolling.</p>}
      {tab === 'bank' ? (
        <div className="bank-trade">
          <p className="label">Give</p>
          <div className="pick-row">
            {RESOURCES.map((r) => (
              <button
                key={r}
                className={`pick ${give === r ? 'on' : ''}`}
                disabled={res[r] < rates[r]}
                onClick={() => setGive(r)}
              >
                <ResChip r={r} />
                <span>{rates[r]}:1</span>
              </button>
            ))}
          </div>
          <p className="label">Receive</p>
          <div className="pick-row">
            {RESOURCES.map((r) => (
              <button key={r} className={`pick ${get === r ? 'on' : ''}`} disabled={r === give || view.bank[r] === 0} onClick={() => setGet(r)}>
                <ResChip r={r} />
                <span className="muted">{view.bank[r]}</span>
              </button>
            ))}
          </div>
          <button
            className="btn primary wide"
            disabled={!canTrade || !give || !get || give === get}
            onClick={async () => {
              if (give && get && (await dispatch({ type: 'bankTrade', give, get }))) setGet(null);
            }}
          >
            {give && get ? `Trade ${rates[give]} ${RESOURCE_LABEL[give]} → 1 ${RESOURCE_LABEL[get]}` : 'Choose resources'}
          </button>
        </div>
      ) : (
        <div className="player-trade">
          <div className="two-col">
            <div>
              <p className="label">You give</p>
              <ResCounter value={offerGive} onChange={setOfferGive} max={res} />
            </div>
            <div>
              <p className="label">You want</p>
              <ResCounter value={offerGet} onChange={setOfferGet} />
            </div>
          </div>
          {opponents.length > 1 && (
            <div className="recipients">
              <span className="label">Send to</span>
              {opponents.map((p) => (
                <label key={p} className="check">
                  <input
                    type="checkbox"
                    checked={to.includes(p)}
                    onChange={(e) => setTo(e.target.checked ? [...to, p] : to.filter((x) => x !== p))}
                  />
                  {view.players[p].name}
                </label>
              ))}
            </div>
          )}
          <button
            className="btn primary wide"
            disabled={!canTrade || totalRes(offerGive) === 0 || totalRes(offerGet) === 0 || to.length === 0}
            onClick={() => dispatch({ type: 'proposeTrade', give: offerGive, get: offerGet, to })}
          >
            Send offer
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function IncomingTrade({ view, dispatch }: { view: PlayerView; dispatch: Dispatch }) {
  const me = view.me!;
  const trade = view.trade!;
  const res = view.players[me].resources!;
  const [countering, setCountering] = useState(false);
  const [cGive, setCGive] = useState<ResMap>(trade.get);
  const [cGet, setCGet] = useState<ResMap>(trade.give);
  useEffect(() => {
    setCountering(false);
    setCGive(trade.get);
    setCGet(trade.give);
  }, [trade.id]);
  const from = view.players[trade.from];
  const affordable = hasRes(res, trade.get);

  return (
    <Sheet title={`Trade offer from ${from.name}`}>
      {!countering ? (
        <>
          <div className="offer-summary">
            <div>
              You get <ResList res={trade.give} />
            </div>
            <div>
              You give <ResList res={trade.get} />
            </div>
          </div>
          {!affordable && <p className="hint-text">You don't have the cards they want.</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => dispatch({ type: 'respondTrade', tradeId: trade.id, response: 'reject' })}>
              Decline
            </button>
            <button className="btn" onClick={() => setCountering(true)}>
              Counter
            </button>
            <button
              className="btn primary"
              disabled={!affordable}
              onClick={() => dispatch({ type: 'respondTrade', tradeId: trade.id, response: 'accept' })}
            >
              Accept
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="two-col">
            <div>
              <p className="label">You give</p>
              <ResCounter value={cGive} onChange={setCGive} max={res} />
            </div>
            <div>
              <p className="label">You want</p>
              <ResCounter value={cGet} onChange={setCGet} />
            </div>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => setCountering(false)}>
              Back
            </button>
            <button
              className="btn primary"
              disabled={totalRes(cGive) === 0 || totalRes(cGet) === 0}
              onClick={() => dispatch({ type: 'counterTrade', tradeId: trade.id, give: cGive, get: cGet })}
            >
              Send counteroffer
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// --- Development cards -------------------------------------------------------

export function DevSheet({ view, onClose, dispatch }: { view: PlayerView; onClose: () => void; dispatch: Dispatch }) {
  const me = view.me!;
  const p = view.players[me];
  const cards = p.devCards!;
  const [picking, setPicking] = useState<'yearOfPlenty' | 'monopoly' | null>(null);
  const [yop, setYop] = useState<Resource[]>([]);
  const turnOk = view.currentPlayer === me && (view.phase === 'PRE_ROLL' || view.phase === 'MAIN_ACTIONS') && view.freeRoads === 0;

  const groups = new Map<DevCardType, { total: number; playable: number }>();
  for (const c of cards) {
    const g = groups.get(c.type) ?? { total: 0, playable: 0 };
    g.total++;
    if (c.boughtTurn !== view.turn) g.playable++;
    groups.set(c.type, g);
  }

  const reason = (type: DevCardType, g: { playable: number }) => {
    if (type === 'victoryPoint') return 'Counts automatically';
    if (!turnOk) return 'Play on your turn';
    if (p.playedDevThisTurn) return 'One card per turn';
    if (g.playable === 0) return 'Bought this turn';
    return null;
  };

  const play = async (type: DevCardType) => {
    if (type === 'knight' && (await dispatch({ type: 'playKnight' }))) onClose();
    if (type === 'roadBuilding' && (await dispatch({ type: 'playRoadBuilding' }))) onClose();
    if (type === 'yearOfPlenty' || type === 'monopoly') setPicking(type);
  };

  if (picking) {
    return (
      <Sheet title={DEV_LABEL[picking].name} onClose={() => setPicking(null)}>
        <p className="hint-text">
          {picking === 'monopoly' ? 'Choose the resource to collect from every opponent.' : `Choose 2 resources (${yop.length}/2).`}
        </p>
        <div className="pick-row">
          {RESOURCES.map((r) => (
            <button
              key={r}
              className="pick"
              disabled={picking === 'yearOfPlenty' && view.bank[r] - yop.filter((x) => x === r).length <= 0}
              onClick={async () => {
                if (picking === 'monopoly') {
                  if (await dispatch({ type: 'playMonopoly', resource: r })) onClose();
                } else {
                  const next = [...yop, r];
                  if (next.length === 2) {
                    if (await dispatch({ type: 'playYearOfPlenty', resources: [next[0], next[1]] })) onClose();
                    setYop([]);
                  } else setYop(next);
                }
              }}
            >
              <ResChip r={r} n={picking === 'yearOfPlenty' ? yop.filter((x) => x === r).length || undefined : undefined} />
              <span>{RESOURCE_LABEL[r]}</span>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Development cards" onClose={onClose}>
      {cards.length === 0 && <p className="hint-text">You have no development cards. Buy one from the Build menu.</p>}
      <div className="dev-list">
        {[...groups.entries()].map(([type, g]) => {
          const why = reason(type, g);
          return (
            <div key={type} className="dev-card">
              <span className="dev-icon">{DEV_LABEL[type].icon}</span>
              <div className="dev-text">
                <b>
                  {DEV_LABEL[type].name} ×{g.total}
                </b>
                <span className="muted">{DEV_LABEL[type].text}</span>
              </div>
              {type !== 'victoryPoint' && (
                <button className="btn primary small" disabled={!!why} onClick={() => play(type)}>
                  Play
                </button>
              )}
              {why && <span className="reason">{why}</span>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

// --- Robber ---------------------------------------------------------------

export function DiscardSheet({ view, required, dispatch }: { view: PlayerView; required: number; dispatch: Dispatch }) {
  const res = view.players[view.me!].resources!;
  const [pick, setPick] = useState<ResMap>(emptyRes());
  const n = totalRes(pick);
  return (
    <Sheet title={`Discard ${required} cards`}>
      <p className="hint-text">A 7 was rolled and you hold more than 7 cards. Choose {required} to return to the bank.</p>
      <ResCounter value={pick} onChange={setPick} max={res} />
      <button
        className="btn primary wide"
        disabled={n !== required}
        onClick={async () => {
          if (await dispatch({ type: 'discard', resources: pick })) setPick(emptyRes());
        }}
      >
        Discard {n}/{required}
      </button>
    </Sheet>
  );
}

export function StealSheet({ view, dispatch }: { view: PlayerView; dispatch: Dispatch }) {
  return (
    <Sheet title="Steal a card from…">
      <div className="steal-list">
        {view.stealCandidates.map((p) => (
          <button key={p} className="btn wide" onClick={() => dispatch({ type: 'steal', victim: p })}>
            <span className="dot" style={{ background: view.players[p].color }} /> {view.players[p].name} ({view.players[p].resourceCount} cards)
          </button>
        ))}
      </div>
    </Sheet>
  );
}
