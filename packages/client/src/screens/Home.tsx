import { useEffect, useState } from 'react';
import { MODS, type BotDifficulty } from '@hex/engine';
import { emit, saveToken, useConnected, type RoomConfig } from '../net';
import { displayName, errorText, getLang, randomBotNames, t, type Lang } from '../i18n';
import { LanguagePicker } from '../game/GameScreen';
import { HelpContent } from './Help';
import { ModPicker } from './ModPicker';

/** Most participants any installed mod allows. */
export const MAX_PARTICIPANTS = Math.max(...Object.values(MODS).map((m) => m.maxPlayers));

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

/** Keeps humans + bots within 2..MAX_PARTICIPANTS and one level per bot. */
export function fitConfig(c: RoomConfig): RoomConfig {
  const humans = Math.min(MAX_PARTICIPANTS, Math.max(1, c.humans));
  let bots = Math.min(MAX_PARTICIPANTS - 1, Math.max(0, c.bots));
  if (humans + bots > MAX_PARTICIPANTS) bots = MAX_PARTICIPANTS - humans;
  if (humans + bots < 2) bots = 2 - humans;
  const current = c.botDifficulties ?? [];
  const botDifficulties = Array.from({ length: bots }, (_, i) => current[i] ?? c.difficulty ?? 'medium');
  return { ...c, humans, bots, botDifficulties };
}

export function Home({ navigate, onLang }: { navigate: (path: string) => void; onLang: (l: Lang) => void }) {
  const [name, setName] = useState(loadNickname());
  const [config, setConfig] = useState<RoomConfig>({
    mod: 'base',
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
  // Step 2 (mod + settings) is a history entry, so the phone's back button returns to step 1.
  const [step, setStep] = useState<'players' | 'mod'>('players');
  useEffect(() => {
    // A reload on step 2 starts at step 1, so the entry must say so too.
    if ((history.state as { homeStep?: string } | null)?.homeStep === 'mod') history.replaceState(null, '');
    const onPop = () => setStep((history.state as { homeStep?: string } | null)?.homeStep === 'mod' ? 'mod' : 'players');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const chooseMod = () => {
    saveNickname(name.trim());
    history.pushState({ homeStep: 'mod' }, '');
    setStep('mod');
  };

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

  if (step === 'mod') {
    return (
      <ModPicker
        config={config}
        update={update}
        onBack={() => history.back()}
        onCreate={create}
        canCreate={!!name.trim() && !busy && connected}
        createLabel={connected ? t('createGame') : t('offline')}
        error={error}
      />
    );
  }

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
        <Stepper label={t('humans')} value={config.humans} min={1} max={MAX_PARTICIPANTS} onChange={(humans) => update({ humans })} />
        <Stepper
          label={t('bots')}
          value={config.bots}
          min={config.humans === 1 ? 1 : 0}
          max={MAX_PARTICIPANTS - config.humans}
          onChange={(bots) => update({ bots })}
        />
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
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide big" disabled={!name.trim()} onClick={chooseMod}>
          {t('chooseMod')} {getLang() === 'he' ? '←' : '→'}
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
