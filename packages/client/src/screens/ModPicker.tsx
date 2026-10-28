import type { CSSProperties, PointerEvent } from 'react';
import { MODS, isModId, type ModId } from '@hex/engine';
import type { RoomConfig } from '../net';
import { getLang, t, type Key } from '../i18n';

/**
 * Every mod the game will offer, in menu order. Ids that exist in the engine's
 * MODS are playable; the rest show as "coming soon" so players see where the
 * game is going. Mods with box art (`box` + the colour of the box's side)
 * stand as 3D game boxes; the rest are rows with a cluster of hex tiles.
 */
const CATALOG: Array<{ id: string; tiles: [string, string, string]; sea?: boolean; box?: { art: string; side: string } }> = [
  { id: 'base', tiles: ['fields', 'forest', 'mountains'], box: { art: '/art/mod-base.webp', side: '#c8432f' } },
  { id: 'seafarers', tiles: ['pasture', 'forest', 'hills'], sea: true, box: { art: '/art/mod-seafarers.webp', side: '#1f9cc0' } },
  { id: 'citiesKnights', tiles: ['mountains', 'hills', 'fields'] },
  { id: 'tradersBarbarians', tiles: ['desert', 'fields', 'pasture'] },
  { id: 'explorersPirates', tiles: ['forest', 'mountains', 'pasture'], sea: true },
];

const modText = (id: string, suffix = '') => t(`mod_${id}${suffix}` as Key);

/** Display name of a mod (lobby tag, etc.). */
export const modName = (id: string | undefined) => modText(id ?? 'base');

function ModArt({ tiles, sea }: { tiles: [string, string, string]; sea?: boolean }) {
  return (
    <span className={`mod-art${sea ? ' sea' : ''}`} aria-hidden>
      {tiles.map((terrain, i) => (
        <img key={i} className={`t${i}`} src={`/art/hex-${terrain}-${i % 2}.webp`} alt="" />
      ))}
    </span>
  );
}

/** Tilts a box a little toward the finger or mouse while it hovers / presses. */
function tilt(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.setProperty('--ry', `${(x * 18).toFixed(1)}deg`);
  e.currentTarget.style.setProperty('--rx', `${(-y * 14).toFixed(1)}deg`);
}
function untilt(e: PointerEvent<HTMLElement>) {
  e.currentTarget.style.removeProperty('--ry');
  e.currentTarget.style.removeProperty('--rx');
}

function GameBox({ id, art, side, on, playable, onPick }: { id: string; art: string; side: string; on: boolean; playable: boolean; onPick: () => void }) {
  const soon = !isModId(id);
  return (
    <button
      role="radio"
      aria-checked={on}
      className={`game-box${on ? ' on' : ''}${soon ? ' soon' : ''}${!soon && !playable ? ' blocked' : ''}`}
      style={{ '--side': side } as CSSProperties}
      disabled={!playable}
      onClick={onPick}
      onPointerMove={playable ? tilt : undefined}
      onPointerLeave={untilt}
    >
      <span className="box-stage">
        <span className="box-3d">
          <span className="box-side right" />
          <span className="box-side bottom" />
          <img className="box-lid" src={art} alt="" draggable={false} />
          {soon && <span className="box-ribbon">{t('comingSoon')}</span>}
        </span>
        <span className="box-floor" />
      </span>
      <span className="box-name">{modText(id)}</span>
    </button>
  );
}

/** Second step of creating a game: pick the mod and its settings, then create. */
export function ModPicker({
  config,
  update,
  onBack,
  onCreate,
  canCreate,
  createLabel,
  error,
}: {
  config: RoomConfig;
  update: (patch: Partial<RoomConfig>) => void;
  onBack: () => void;
  onCreate: () => void;
  canCreate: boolean;
  createLabel: string;
  error: string | null;
}) {
  const participants = config.humans + config.bots;
  const selected = config.mod ?? 'base';
  const rtl = getLang() === 'he';

  return (
    <div className="screen home scenic mod-screen">
      <div className="mod-head">
        <button className="btn ghost on-dark back" onClick={onBack}>
          {rtl ? '→' : '←'} {t('back')}
        </button>
        <h1>{t('modTitle')}</h1>
        <p className="tagline">{t('modSubtitle')}</p>
      </div>

      <div className="card panel">
        <div className="mod-shelf" role="radiogroup" aria-label={t('modTitle')}>
          {CATALOG.filter((c) => c.box).map(({ id, box }) => {
            const mod = isModId(id) ? MODS[id] : null;
            const playable = mod !== null && participants >= mod.minPlayers && participants <= mod.maxPlayers;
            return <GameBox key={id} id={id} art={box!.art} side={box!.side} on={playable && selected === id} playable={playable} onPick={() => update({ mod: id as ModId })} />;
          })}
        </div>
        <div className="mod-detail" aria-live="polite">
          <b>{modText(selected)}</b>
          <small>{modText(selected, '_desc')}</small>
          <span className="mod-meta">{t('modPlayers', { min: MODS[selected].minPlayers, max: MODS[selected].maxPlayers })}</span>
        </div>

        <div className="mod-list">
          {CATALOG.filter((c) => !c.box).map(({ id, tiles, sea }) => {
            const mod = isModId(id) ? MODS[id] : null;
            const fits = mod ? participants >= mod.minPlayers && participants <= mod.maxPlayers : false;
            const playable = mod !== null && fits;
            const on = playable && selected === id;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                className={`mod-card${on ? ' on' : ''}${mod ? '' : ' soon'}${mod && !fits ? ' blocked' : ''}`}
                disabled={!playable}
                onClick={() => update({ mod: id as ModId })}
              >
                <ModArt tiles={tiles} sea={sea} />
                <span className="mod-text">
                  <b>{modText(id)}</b>
                  <small>{modText(id, '_desc')}</small>
                  {mod && (
                    <span className="mod-meta">{fits ? t('modPlayers', { min: mod.minPlayers, max: mod.maxPlayers }) : t('modTooMany', { n: participants })}</span>
                  )}
                </span>
                {!mod && <span className="soon-tag">{t('comingSoon')}</span>}
              </button>
            );
          })}
        </div>

        <p className="mod-settings-title">{t('modSettings')}</p>
        <div className="seg">
          <span>{t('victoryTarget')}</span>
          <div className="seg-buttons">
            {[10, 12].map((n) => (
              <button key={n} className={config.victoryTarget === n ? 'on' : ''} onClick={() => update({ victoryTarget: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="seg">
          <span>{t('board')}</span>
          <div className="seg-buttons">
            <button className={config.boardType === 'random' ? 'on' : ''} onClick={() => update({ boardType: 'random' })}>
              {t('randomBoard')}
            </button>
            <button className={config.boardType === 'beginner' ? 'on' : ''} onClick={() => update({ boardType: 'beginner' })}>
              {t('beginnerBoard')}
            </button>
          </div>
        </div>
        <label className="check house-rule">
          <input type="checkbox" checked={!!config.startResBoth} onChange={(e) => update({ startResBoth: e.target.checked })} />
          <span>
            <b>{t('houseStartRes')}</b>
            <small>{t('houseStartResInfo')}</small>
          </span>
        </label>
        <label className="check house-rule">
          <input type="checkbox" checked={!!config.devSameTurn} onChange={(e) => update({ devSameTurn: e.target.checked })} />
          <span>
            <b>{t('houseDevNow')}</b>
            <small>{t('houseDevNowInfo')}</small>
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide big" disabled={!canCreate} onClick={onCreate}>
          {createLabel}
        </button>
      </div>
    </div>
  );
}
