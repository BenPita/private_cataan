import { useState } from 'react';
import { emit, saveToken, useConnected, type RoomConfig } from '../net';
import { t } from '../strings';
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

function Stepper({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className={`stepper ${disabled ? 'disabled' : ''}`}>
      <span>{label}</span>
      <div className="row">
        <button className="round" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <b>{value}</b>
        <button className="round" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const [name, setName] = useState(loadNickname());
  const [config, setConfig] = useState<RoomConfig>({ humans: 2, bots: 0, difficulty: 'medium', victoryTarget: 10, boardType: 'random' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const connected = useConnected();

  const create = async () => {
    setBusy(true);
    setError(null);
    saveNickname(name.trim());
    const res = await emit<{ roomId: string; token: string }>('room:create', { name, config });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    saveToken(res.roomId, res.token);
    navigate(`/g/${res.roomId}`);
  };

  return (
    <div className="screen home">
      <div className="logo">
        <svg viewBox="0 0 64 64" width="84" height="84" aria-hidden>
          <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="#e8c46a" stroke="#fff3cf" strokeWidth="3" />
          <polygon points="32,18 44,25 44,39 32,46 20,39 20,25" fill="#3f9b4b" />
          <polygon points="26,36 32,24 38,36" fill="#6b7480" />
        </svg>
        <h1>{t.appName}</h1>
        <p className="muted">{t.tagline}</p>
      </div>

      <div className="card">
        <label className="field">
          <span>{t.nickname}</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Roy" />
        </label>
        <Stepper
          label={t.humans}
          value={config.humans}
          min={2}
          max={4}
          onChange={(humans) => setConfig({ ...config, humans })}
        />
        <Stepper label={t.bots} value={0} min={0} max={0} onChange={() => {}} disabled />
        <p className="tiny muted">{t.botsSoon}</p>
        <div className="seg">
          <span>{t.victoryTarget}</span>
          <div className="seg-buttons">
            {[10, 12].map((n) => (
              <button key={n} className={config.victoryTarget === n ? 'on' : ''} onClick={() => setConfig({ ...config, victoryTarget: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="seg">
          <span>{t.board}</span>
          <div className="seg-buttons">
            <button className={config.boardType === 'random' ? 'on' : ''} onClick={() => setConfig({ ...config, boardType: 'random' })}>
              {t.randomBoard}
            </button>
            <button className={config.boardType === 'beginner' ? 'on' : ''} onClick={() => setConfig({ ...config, boardType: 'beginner' })}>
              {t.beginnerBoard}
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide big" disabled={!name.trim() || busy || !connected} onClick={create}>
          {connected ? t.createGame : t.offline}
        </button>
      </div>

      <button className="btn ghost on-dark" onClick={() => setHelp(!help)}>
        📖 {t.rules}
      </button>
      {help && (
        <div className="card help-card">
          <HelpContent />
        </div>
      )}
    </div>
  );
}
