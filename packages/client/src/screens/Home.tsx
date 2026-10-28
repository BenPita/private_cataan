import { useState } from 'react';
import type { BotDifficulty } from '@hex/engine';
import { emit, saveToken, useConnected, type RoomConfig } from '../net';
import { displayName, errorText, randomBotNames, t, type Lang } from '../i18n';
import { LanguagePicker } from '../game/GameScreen';
import { HelpContent } from './Help';

export function loadNickname() {
  try {
    return localStorage.getItem('hex-name') ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(name: string) {
  try {
    localStorage.setItem('hex-name', name);
  } catch {
    /* ignore */
  }
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div className="row">
        <button className="round" disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <b>{value}</b>
        <button className="round" disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

export function DifficultyPicker({ value, onChange }: { value: BotDifficulty; onChange: (d: BotDifficulty) => void }) {
  return (
    <div className="seg">
      <span>{t('difficulty')}</span>
      <div className="seg-buttons">
        {(['easy', 'medium', 'hard'] as const).map((d) => (
          <button key={d} className={value === d ? 'on' : ''} onClick={() => onChange(d)}>
            {t(d)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One level picker per bot. */
export function BotLevels({
  levels,
  names,
  onChange,
}: {
  levels: BotDifficulty[];
  /** The bots' names once the room has drawn them. */
  names?: string[];
  onChange: (levels: BotDifficulty[]) => void;
}) {
  return (
    <div className="bot-levels">
      {levels.map((level, i) => (
        <div key={i} className="seg">
          <span>🤖 {names?.[i] ?? t('botName', { n: i + 1 })}</span>
          <div className="seg-buttons">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button key={d} className={level === d ? 'on' : ''} onClick={() => onChange(levels.map((l, k) => (k === i ? d : l)))}>
                {t(d)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Keeps humans + bots within 2..4 and one level per bot. */
export function fitConfig(c: RoomConfig): RoomConfig {
  const humans = Math.min(4, Math.max(1, c.humans));
  let bots = Math.min(3, Math.max(0, c.bots));
  if (humans + bots > 4) bots = 4 - humans;
  if (humans + bots < 2) bots = 2 - humans;
  const current = c.botDifficulties ?? [];
  const botDifficulties = Array.from({ length: bots }, (_, i) => current[i] ?? c.difficulty ?? 'medium');
  return { ...c, humans, bots, botDifficulties };
}

export function Home({ navigate, onLang }: { navigate: (path: string) => void; onLang: (l: Lang) => void }) {
  const [name, setName] = useState(loadNickname());
  const [config, setConfig] = useState<RoomConfig>({
    humans: 2,
    bots: 2,
    difficulty: 'medium',
    botDifficulties: ['medium', 'medium'],
    victoryTarget: 10,
    boardType: 'random',
    startResBoth: false,
    devSameTurn: false,
    botNames: randomBotNames(),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const connected = useConnected();
  const update = (patch: Partial<RoomConfig>) => setConfig((c) => fitConfig({ ...c, ...patch }));

  const create = async () => {
    setBusy(true);
    setError(null);
    saveNickname(name.trim());
    const res = await emit<{ roomId: string; token: string }>('room:create', { name, config });
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    saveToken(res.roomId, res.token);
    navigate(`/g/${res.roomId}`);
  };

  return (
    <div className="screen home scenic">
      <div className="logo">
        <h1>{t('appName')}</h1>
        <p className="tagline">{t('tagline')}</p>
      </div>

      <div className="card panel">
        <label className="field">
          <span>{t('nickname')}</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder={t('nicknamePlaceholder')} />
        </label>
        <Stepper label={t('humans')} value={config.humans} min={1} max={4} onChange={(humans) => update({ humans })} />
        <Stepper label={t('bots')} value={config.bots} min={config.humans === 1 ? 1 : 0} max={4 - config.humans} onChange={(bots) => update({ bots })} />
        {config.bots > 0 && (
          <BotLevels
            levels={config.botDifficulties}
            names={config.botNames?.map((n) => displayName(n, 'bot'))}
            onChange={(botDifficulties) => update({ botDifficulties })}
          />
        )}
        <p className="tiny muted">
          {t('participants', { n: config.humans + config.bots })}
          {config.humans === 1 ? ` · ${t('soloHint')}` : ''}
        </p>
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
        <button className="btn primary wide big" disabled={!name.trim() || busy || !connected} onClick={create}>
          {connected ? t('createGame') : t('offline')}
        </button>
      </div>

      <div className="card panel slim">
        <LanguagePicker onLang={onLang} />
      </div>

      <button className="btn ghost on-dark" onClick={() => setHelp(!help)}>
        📖 {t('rules')}
      </button>
      {help && (
        <div className="card panel help-card">
          <HelpContent />
        </div>
      )}
    </div>
  );
}
