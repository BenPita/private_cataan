import { useEffect, useState } from 'react';
import { emit, saveToken, useConnected, useRoom, type RoomSnapshot } from '../net';
import { displayName, errorText, t, type Lang } from '../i18n';
import { GameScreen } from '../game/GameScreen';
import { DifficultyPicker, Stepper, fitConfig, loadNickname, saveNickname } from './Home';

export function Room({ roomId, navigate, onLang }: { roomId: string; navigate: (p: string) => void; onLang: (l: Lang) => void }) {
  const { snapshot, status, error } = useRoom(roomId);
  const connected = useConnected();

  let body;
  if (status === 'error') {
    body = (
      <div className="screen center">
        <div className="card parchment">
          <h2>{error ? errorText(error) : ''}</h2>
          <button className="btn primary wide" onClick={() => navigate('/')}>
            {t('home')}
          </button>
        </div>
      </div>
    );
  } else if (status === 'needs-join') {
    body = <JoinForm roomId={roomId} />;
  } else if (!snapshot) {
    body = <div className="screen center muted-light">{t('loading')}</div>;
  } else if (snapshot.status === 'lobby') {
    body = <Lobby snapshot={snapshot} />;
  } else {
    body = <GameScreen snapshot={snapshot} onLang={onLang} />;
  }

  return (
    <>
      {!connected && <div className="offline-banner">{t('offline')}</div>}
      {body}
    </>
  );
}

function JoinForm({ roomId }: { roomId: string }) {
  const [name, setName] = useState(loadNickname());
  const [info, setInfo] = useState<{ host: string; openSeats: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    emit<{ host: string; openSeats: number; status: string }>('room:peek', { roomId }).then((r) => {
      if (r.ok) setInfo(r);
      else setError(errorText(r.error));
    });
  }, [roomId]);

  const join = async () => {
    setBusy(true);
    saveNickname(name.trim());
    const res = await emit<{ token: string }>('room:join', { roomId, name });
    setBusy(false);
    if (!res.ok) return setError(errorText(res.error));
    saveToken(roomId, res.token);
  };

  const closed = info && (info.status !== 'lobby' || info.openSeats === 0);
  return (
    <div className="screen center">
      <div className="card parchment">
        <h2>{info ? t('invitedBy', { name: info.host }) : t('joinGame')}</h2>
        {closed ? (
          <p className="muted">{t('gameClosed', { state: info!.status === 'lobby' ? t('stateFull') : t('stateRunning') })}</p>
        ) : (
          <>
            <label className="field">
              <span>{t('nickname')}</span>
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <button className="btn primary wide big" disabled={!name.trim() || busy || !info} onClick={join}>
              {t('joinGame')}
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

function Lobby({ snapshot }: { snapshot: RoomSnapshot }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = `${location.origin}/g/${snapshot.id}`;
  const isHost = snapshot.you === 0;
  const me = snapshot.seats[snapshot.you];
  const allReady = snapshot.seats.every((s) => s.kind === 'bot' || (s.claimed && s.ready));
  const needsInvite = snapshot.config.humans > 1;
  const claimedHumans = snapshot.seats.filter((s) => s.kind === 'human' && s.claimed).length;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t('appName'), text: t('whatsappText', { link: '' }), url: link });
        return;
      } catch {
        /* fall back to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('', link);
    }
  };

  const call = async (event: string, payload?: unknown) => {
    const r = await emit(event, payload);
    setError(r.ok ? null : errorText(r.error));
  };

  const setConfig = (patch: Partial<RoomSnapshot['config']>) => {
    const next = fitConfig({ ...snapshot.config, ...patch });
    if (next.humans < claimedHumans) return;
    call('room:config', { config: next });
  };

  return (
    <div className="screen lobby">
      <h1 className="title-light">{t('lobby')}</h1>
      {needsInvite && (
        <div className="card parchment">
          <p className="label">{t('invite')}</p>
          <div className="invite">
            <code dir="ltr">{link}</code>
            <button className="btn primary" onClick={share}>
              {copied ? t('copied') : t('share')}
            </button>
          </div>
          <a className="btn whatsapp wide" href={`https://wa.me/?text=${encodeURIComponent(t('whatsappText', { link }))}`} target="_blank" rel="noreferrer">
            {t('sendWhatsapp')}
          </a>
        </div>
      )}

      <div className="card parchment">
        <p className="label">{t('playersTitle', { n: snapshot.config.victoryTarget })}</p>
        <ul className="seats">
          {snapshot.seats.map((s, i) => (
            <li key={i}>
              <span className="seat-num">{i + 1}</span>
              <span className="seat-name">
                {s.kind === 'bot' ? (
                  <>
                    🤖 {displayName(s.name, 'bot')} <span className="tag">{t(s.difficulty ?? 'medium')}</span>
                  </>
                ) : s.claimed ? (
                  s.name
                ) : (
                  <span className="muted">{t('emptySeat')}</span>
                )}
                {i === 0 && <span className="tag">{t('host')}</span>}
                {i === snapshot.you && <span className="tag you">{t('you')}</span>}
              </span>
              {s.claimed && s.kind === 'human' && <span className={`ready ${s.ready ? 'on' : ''}`}>{s.ready ? `✓ ${t('ready')}` : t('notReady')}</span>}
              {s.claimed && s.kind === 'human' && !s.connected && <span className="offline-tag">{t('disconnected')}</span>}
            </li>
          ))}
        </ul>
        {isHost && (
          <div className="host-controls">
            <Stepper label={t('humans')} value={snapshot.config.humans} min={Math.max(1, claimedHumans)} max={4} onChange={(humans) => setConfig({ humans })} />
            <Stepper
              label={t('bots')}
              value={snapshot.config.bots}
              min={snapshot.config.humans === 1 ? 1 : 0}
              max={4 - snapshot.config.humans}
              onChange={(bots) => setConfig({ bots })}
            />
            {snapshot.config.bots > 0 && <DifficultyPicker value={snapshot.config.difficulty} onChange={(difficulty) => setConfig({ difficulty })} />}
          </div>
        )}
      </div>

      {error && <p className="error on-dark">{error}</p>}
      {isHost ? (
        <button className="btn primary wide big" disabled={!allReady} onClick={() => call('room:start')}>
          {allReady ? t('start') : t('waitingFor')}
        </button>
      ) : (
        <button className={`btn wide big ${me.ready ? '' : 'primary'}`} onClick={() => call('room:ready', { ready: !me.ready })}>
          {me.ready ? `✓ ${t('readyWaitHost')}` : t('imReady')}
        </button>
      )}
    </div>
  );
}
