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
  type Action,
  type DevCardType,
  type PlayerView,
  type ResMap,
  type Resource,
} from '@hex/engine';
import { DevCardFace, ResourceCard } from '../art';
import { devInfo, displayName, resourceName, t } from '../i18n';
import type { PublicSeat } from '../net';

export type Dispatch = (a: Action) => Promise<boolean>;

export const playerName = (view: PlayerView, i: number) => displayName(view.players[i].name, view.players[i].kind);

export function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label={t('close')}>
              ✕
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ResList({ res }: { res: Partial<ResMap> }) {
  const items = RESOURCES.filter((r) => (res[r] ?? 0) > 0);
  if (!items.length) return <span className="muted">{t('nothing')}</span>;
  return (
    <span className="res-list">
      {items.map((r) => (
        <ResourceCard key={r} r={r} count={res[r]} small />
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
          <ResourceCard r={r} small />
          <span className="res-name">{resourceName(r)}</span>
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

/** The player's hand: one card per resource type with a count. */
export function ResourceBar({ res, flash }: { res: ResMap; flash: Partial<ResMap> }) {
  return (
    <div className="hand">
      {RESOURCES.map((r) => (
        <div key={r} className="hand-slot" title={resourceName(r)}>
          <ResourceCard r={r} count={res[r]} dim={res[r] === 0} />
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
      {view.turnOrder.map((i) => {
        const p = view.players[i];
        return (
          <div
            key={i}
            className={`player-chip ${view.currentPlayer === i && view.phase !== 'GAME_OVER' && view.phase !== 'ORDER_ROLL' ? 'active' : ''}`}
            style={{ ['--pc' as string]: p.color }}
          >
            <div className="chip-top">
              <span className="dot" style={{ background: p.color }} />
              <span className="pname">
                {p.kind === 'bot' ? '🤖 ' : ''}
                {playerName(view, i)}
                {i === view.me ? ` (${t('you')})` : ''}
              </span>
              {!seats[i]?.connected && <span className="offline-tag">{t('disconnected')}</span>}
            </div>
            <div className="chip-stats">
              <span title={t('vp')} className="vp">
                ★ {p.victoryPoints}
              </span>
              <span title={t('resCards')}>🂠 {p.resourceCount}</span>
              <span title={t('devCount')}>📜 {p.devCardCount}</span>
              <span title={t('knights')}>⚔ {p.knightsPlayed}</span>
            </div>
            {(view.longestRoad.holder === i || view.largestArmy === i) && (
              <div className="chip-badges">
                {view.longestRoad.holder === i && <span className="badge">🛤 {t('longestRoad')}</span>}
                {view.largestArmy === i && <span className="badge">🛡 {t('largestArmy')}</span>}
              </div>
            )}
          </div>
        );
      })}
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

  const items: Array<{ key: BuildMode | 'devCard'; left: string; leftN: number; spots: number; reason: string | null }> = [
    { key: 'road', leftN: PIECE_LIMITS.roads - p.roadsBuilt, left: '', spots: legalRoads(view, me).length, reason: null },
    {
      key: 'settlement',
      leftN: PIECE_LIMITS.settlements - (p.settlementsBuilt - p.citiesBuilt),
      left: '',
      spots: legalSettlements(view, me).length,
      reason: null,
    },
    { key: 'city', leftN: PIECE_LIMITS.cities - p.citiesBuilt, left: '', spots: legalCities(view, me).length, reason: null },
    { key: 'devCard', leftN: view.devDeckCount, left: '', spots: view.devDeckCount, reason: null },
  ];
  for (const it of items) {
    it.left = it.key === 'devCard' ? t('inDeck', { n: it.leftN }) : t('left', { n: it.leftN });
    const cost = COSTS[it.key];
    if (!canAct) it.reason = view.currentPlayer !== me ? t('reasonNotTurn') : view.phase === 'PRE_ROLL' ? t('reasonRollFirst') : t('reasonNotNow');
    else if (it.leftN <= 0) it.reason = it.key === 'devCard' ? t('reasonDeckEmpty') : t('reasonNoPieces');
    else if (it.spots === 0) it.reason = t('reasonNoSpot');
    else if (!hasRes(res, cost)) it.reason = t('reasonNoRes');
  }

  return (
    <Sheet title={t('build')} onClose={onClose}>
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
              <b>{t(it.key)}</b>
              <span className="muted">{it.left}</span>
            </div>
            <ResList res={COSTS[it.key]} />
            {it.reason && <span className="reason">{it.reason}</span>}
          </button>
        ))}
      </div>
      {confirmDev && (
        <div className="confirm-inline">
          <span>
            {t('buyDevConfirm')} <ResList res={COSTS.devCard} />?
          </span>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmDev(false)}>
              {t('cancel')}
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                if (await dispatch({ type: 'buyDevCard' })) onClose();
              }}
            >
              {t('confirm')}
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
  const sameBoth = RESOURCES.some((r) => offerGive[r] > 0 && offerGet[r] > 0);

  if (trade) {
    return (
      <Sheet title={t('yourOffer')} onClose={onClose}>
        <div className="offer-summary">
          <div>
            {t('youGive')} <ResList res={trade.give} />
          </div>
          <div>
            {t('youGet')} <ResList res={trade.get} />
          </div>
        </div>
        <div className="responses">
          {trade.to.map((p) => {
            const r = trade.responses[p];
            const counter = trade.counters[p];
            return (
              <div key={p} className="response-row">
                <span className="dot" style={{ background: view.players[p].color }} />
                <b>{playerName(view, p)}</b>
                {r === 'pending' && <span className="muted">{t('thinking')}</span>}
                {r === 'rejected' && <span className="muted">{t('declinedTag')}</span>}
                {r === 'accepted' && (
                  <button className="btn primary small" onClick={() => dispatch({ type: 'confirmTrade', tradeId: trade.id, with: p })}>
                    {t('acceptDeal')}
                  </button>
                )}
                {r === 'countered' && counter && (
                  <div className="counter-box">
                    <span>
                      {t('youGive')} <ResList res={counter.give} /> · {t('youGet')} <ResList res={counter.get} />
                    </span>
                    <button className="btn primary small" onClick={() => dispatch({ type: 'confirmTrade', tradeId: trade.id, with: p })}>
                      {t('acceptCounter')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn ghost wide" onClick={() => dispatch({ type: 'cancelTrade' })}>
          {t('withdraw')}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('trade')} onClose={onClose}>
      <div className="tabs">
        <button className={tab === 'player' ? 'on' : ''} onClick={() => setTab('player')}>
          {t('tabPlayers')}
        </button>
        <button className={tab === 'bank' ? 'on' : ''} onClick={() => setTab('bank')}>
          {t('tabBank')}
        </button>
      </div>
      {!canTrade && <p className="hint-text">{t('tradeWhen')}</p>}
      {tab === 'bank' ? (
        <div className="bank-trade">
          <p className="label">{t('give')}</p>
          <div className="pick-row">
            {RESOURCES.map((r) => (
              <button key={r} className={`pick ${give === r ? 'on' : ''}`} disabled={res[r] < rates[r]} onClick={() => setGive(r)}>
                <ResourceCard r={r} small />
                <span>{rates[r]}:1</span>
              </button>
            ))}
          </div>
          <p className="label">{t('receive')}</p>
          <div className="pick-row">
            {RESOURCES.map((r) => (
              <button key={r} className={`pick ${get === r ? 'on' : ''}`} disabled={r === give || view.bank[r] === 0} onClick={() => setGet(r)}>
                <ResourceCard r={r} small />
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
            {give && get ? t('bankTradeBtn', { n: rates[give], give: resourceName(give), get: resourceName(get) }) : t('chooseRes')}
          </button>
        </div>
      ) : (
        <div className="player-trade">
          <div className="two-col">
            <div>
              <p className="label">{t('youGive')}</p>
              <ResCounter value={offerGive} onChange={setOfferGive} max={res} />
            </div>
            <div>
              <p className="label">{t('youWant')}</p>
              <ResCounter value={offerGet} onChange={setOfferGet} />
            </div>
          </div>
          {opponents.length > 1 && (
            <div className="recipients">
              <span className="label">{t('sendTo')}</span>
              {opponents.map((p) => (
                <label key={p} className="check">
                  <input
                    type="checkbox"
                    checked={to.includes(p)}
                    onChange={(e) => setTo(e.target.checked ? [...to, p] : to.filter((x) => x !== p))}
                  />
                  {playerName(view, p)}
                </label>
              ))}
            </div>
          )}
          <button
            className="btn primary wide"
            disabled={!canTrade || totalRes(offerGive) === 0 || totalRes(offerGet) === 0 || to.length === 0 || sameBoth}
            onClick={() => dispatch({ type: 'proposeTrade', give: offerGive, get: offerGet, to })}
          >
            {t('sendOffer')}
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
  const affordable = hasRes(res, trade.get);

  return (
    <Sheet title={t('offerFrom', { name: playerName(view, trade.from) })}>
      {!countering ? (
        <>
          <div className="offer-summary">
            <div>
              {t('youGet')} <ResList res={trade.give} />
            </div>
            <div>
              {t('youGive')} <ResList res={trade.get} />
            </div>
          </div>
          {!affordable && <p className="hint-text">{t('cantAfford')}</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => dispatch({ type: 'respondTrade', tradeId: trade.id, response: 'reject' })}>
              {t('decline')}
            </button>
            <button className="btn" onClick={() => setCountering(true)}>
              {t('counter')}
            </button>
            <button
              className="btn primary"
              disabled={!affordable}
              onClick={() => dispatch({ type: 'respondTrade', tradeId: trade.id, response: 'accept' })}
            >
              {t('accept')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="two-col">
            <div>
              <p className="label">{t('youGive')}</p>
              <ResCounter value={cGive} onChange={setCGive} max={res} />
            </div>
            <div>
              <p className="label">{t('youWant')}</p>
              <ResCounter value={cGet} onChange={setCGet} />
            </div>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => setCountering(false)}>
              {t('back')}
            </button>
            <button
              className="btn primary"
              disabled={totalRes(cGive) === 0 || totalRes(cGet) === 0}
              onClick={() => dispatch({ type: 'counterTrade', tradeId: trade.id, give: cGive, get: cGet })}
            >
              {t('sendCounter')}
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
    if (type === 'victoryPoint') return t('devAuto');
    if (!turnOk) return t('devOnTurn');
    if (p.playedDevThisTurn) return t('devOnePerTurn');
    if (g.playable === 0) return t('devBoughtNow');
    return null;
  };

  const play = async (type: DevCardType) => {
    if (type === 'knight' && (await dispatch({ type: 'playKnight' }))) onClose();
    if (type === 'roadBuilding' && (await dispatch({ type: 'playRoadBuilding' }))) onClose();
    if (type === 'yearOfPlenty' || type === 'monopoly') setPicking(type);
  };

  if (picking) {
    return (
      <Sheet title={devInfo(picking).name} onClose={() => setPicking(null)}>
        <p className="hint-text">{picking === 'monopoly' ? t('monopolyPick') : t('inventionPick', { n: yop.length })}</p>
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
              <ResourceCard r={r} small count={picking === 'yearOfPlenty' ? yop.filter((x) => x === r).length || undefined : undefined} />
              <span>{resourceName(r)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('devCards')} onClose={onClose}>
      {cards.length === 0 && <p className="hint-text">{t('noDevCards')}</p>}
      <div className="dev-list">
        {[...groups.entries()].map(([type, g]) => {
          const why = reason(type, g);
          const info = devInfo(type);
          return (
            <div key={type} className="dev-card">
              <DevCardFace type={type} title={info.name} />
              <div className="dev-text">
                <b>
                  {info.name} ×{g.total}
                </b>
                <span className="muted">{info.text}</span>
                {why && <span className="reason">{why}</span>}
              </div>
              {type !== 'victoryPoint' && (
                <button className="btn primary small" disabled={!!why} onClick={() => play(type)}>
                  {t('play')}
                </button>
              )}
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
    <Sheet title={t('discardTitle', { n: required })}>
      <p className="hint-text">{t('discardText', { n: required })}</p>
      <ResCounter value={pick} onChange={setPick} max={res} />
      <button
        className="btn primary wide"
        disabled={n !== required}
        onClick={async () => {
          if (await dispatch({ type: 'discard', resources: pick })) setPick(emptyRes());
        }}
      >
        {t('discardBtn', { k: n, n: required })}
      </button>
    </Sheet>
  );
}

export function StealSheet({ view, dispatch }: { view: PlayerView; dispatch: Dispatch }) {
  return (
    <Sheet title={t('stealTitle')}>
      <div className="steal-list">
        {view.stealCandidates.map((p) => (
          <button key={p} className="btn wide" onClick={() => dispatch({ type: 'steal', victim: p })}>
            <span className="dot" style={{ background: view.players[p].color }} /> {playerName(view, p)} (
            {t('cardsCount', { n: view.players[p].resourceCount })})
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// --- Opening roll ------------------------------------------------------------

const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function OrderRollPanel({ view, dispatch, onClose }: { view: PlayerView; dispatch: Dispatch; onClose?: () => void }) {
  const order = view.orderRoll!;
  const decided = view.phase !== 'ORDER_ROLL';
  const me = view.me!;
  const group = order.groups.find((g) => g.length > 1) ?? [];
  const mustRoll = group.includes(me) && !order.rolls[me];
  const tiebreak = order.history.length >= view.players.length;
  const waiting = group.filter((p) => !order.rolls[p]).map((p) => playerName(view, p));
  return (
    <div className="order-roll">
      <div className="order-card">
        <h2>🎲 {t('whoFirst')}</h2>
        <p className="muted">{decided ? t('orderSet') : tiebreak ? t('orderTie') : t('orderIntro')}</p>
        <ul className="order-list">
          {(decided ? view.turnOrder : view.players.map((_, i) => i)).map((i, pos) => {
            const p = view.players[i];
            const rolls = order.history.filter((h) => h.player === i);
            return (
              <li key={i} className={group.includes(i) ? 'rolling' : ''}>
                {decided && <span className="seat-num">{pos + 1}</span>}
                <span className="dot" style={{ background: p.color }} />
                <b>{playerName(view, i)}</b>
                <span className="order-dice">
                  {rolls.map((r, k) => (
                    <span key={k} className={k < rolls.length - 1 ? 'old' : ''}>
                      {DIE[r.dice[0]]}
                      {DIE[r.dice[1]]} <b>{r.dice[0] + r.dice[1]}</b>
                    </span>
                  ))}
                  {group.includes(i) && !order.rolls[i] && <span className="muted">{t('waiting')}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {decided ? (
          <button className="btn primary wide big" onClick={onClose}>
            {t('startsGo', { name: playerName(view, view.turnOrder[0]) })}
          </button>
        ) : mustRoll ? (
          <button className="btn primary wide big pulse" onClick={() => dispatch({ type: 'rollForOrder' })}>
            🎲 {t('roll')}
          </button>
        ) : (
          <p className="muted center">{t('waitingNames', { names: waiting.join(', ') })}</p>
        )}
      </div>
    </div>
  );
}
