import { MODS, isModId, type ModId } from '@hex/engine';
import type { RoomConfig } from '../net';
import { getLang, t, type Key } from '../i18n';

/**
 * Every mod the game will offer, in menu order. Ids that exist in the engine's
 * MODS are playable; the rest show as "coming soon" so players see where the
 * game is going. Art is a small cluster of painted hex tiles.
 */
const CATALOG: Array<{ id: string; tiles: [string, string, string]; sea?: boolean }> = [
  { id: 'base', tiles: ['fields', 'forest', 'mountains'] },
  { id: 'seafarers', tiles: ['pasture', 'forest', 'hills'], sea: true },
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
        <div className="mod-list" role="radiogroup" aria-label={t('modTitle')}>
          {CATALOG.map(({ id, tiles, sea }) => {
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
