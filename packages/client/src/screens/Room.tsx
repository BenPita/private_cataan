import { useEffect, useState } from 'react';
import { emit, saveToken, useConnected, useRoom, type RoomSnapshot } from '../net';
import { t } from '../strings';
import { GameScreen } from '../game/GameScreen';
import { loadNickname, saveNickname } from './Home';

export function Room({ roomId, navigate }: { roomId: string; navigate: (p: string) => void }) {
  const { snapshot, status, error } = useRoom(roomId);
  const connected = useConnected();

  let body;
  if (status === 'error') {
    body = (
      <div className="screen center">
        <div className="card">
          <h2>{error}</h2>
          <button className="btn primary wide" onClick={() => navigate('/')}>
            {t.home}
          </button>
        </div>
      </div>
    );
  } else if (status === 'needs-join') {
    body = <JoinForm roomId={roomId} />;
  } else if (!snapshot) {
    body = <div className="screen center muted">Loading…</div>;
  } else if (snapshot.status === 'lobby') {
    body = <Lobby snapshot={snapshot} />;
  } else {
    body = <GameScreen snapshot={snapshot} />;
  }

  return (
    <>
      {!connected && <div className="offline-banner">{t.offline}</div>}
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
      else setError(r.error);
    });
  }, [roomId]);

  const join = async () => {
    setBusy(true);
    saveNickname(name.trim());
    const res = await emit<{ token: string }>('room:join', { roomId, name });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    saveToken(roomId, res.token);
  };

  const closed = info && (info.status !== 'lobby' || info.openSeats === 0);
  return (
    <div className="screen center">
      <div className="card">
        <h2>{info ? `${info.host} invited you to Hex Islands` : t.joinGame}</h2>
        {closed ? (
          <p className="muted">
            This game is {info!.status === 'lobby' ? 'full' : 'already running'}. If you were playing on another phone, open your
            rejoin link from that phone's settings menu.
          </p>
        ) : (
          <>
            <label className="field">
              <span>{t.nickname}</span>
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <button className="btn primary wide big" disabled={!name.trim() || busy || !info} onClick={join}>
              {t.joinGame}
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

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hex Islands', text: 'Join my Hex Islands game!', url: link });
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
      prompt('Copy this link', link);
    }
  };

  const call = async (event: string, payload?: unknown) => {
    const r = await emit(event, payload);
    setError(r.ok ? null : r.error);
  };

  return (
    <div className="screen lobby">
      <h1>Lobby</h1>
      <div className="card">
        <p className="label">{t.invite}</p>
        <div className="invite">
          <code>{link}</code>
          <button className="btn primary" onClick={share}>
            {copied ? t.copied : t.share}
          </button>
        </div>
        <a className="btn whatsapp wide" href={`https://wa.me/?text=${encodeURIComponent(`Join my Hex Islands game! ${link}`)}`} target="_blank" rel="noreferrer">
          Send via WhatsApp
        </a>
      </div>

      <div className="card">
        <p className="label">Players · first to {snapshot.config.victoryTarget} points</p>
        <ul className="seats">
          {snapshot.seats.map((s, i) => (
            <li key={i}>
              <span className="seat-num">{i + 1}</span>
              <span className="seat-name">
                {s.kind === 'bot' ? `🤖 ${s.name}` : s.claimed ? s.name : <span className="muted">{t.emptySeat}</span>}
                {i === 0 && <span className="tag">{t.host}</span>}
                {i === snapshot.you && <span className="tag you">{t.you}</span>}
              </span>
              {s.claimed && s.kind === 'human' && (
                <span className={`ready ${s.ready ? 'on' : ''}`}>{s.ready ? `✓ ${t.ready}` : t.notReady}</span>
              )}
              {s.claimed && s.kind === 'human' && !s.connected && <span className="offline-tag">{t.disconnected}</span>}
            </li>
          ))}
        </ul>
        {isHost && (
          <div className="host-controls">
            <span>{t.humans}</span>
            <div className="seg-buttons">
              {[2, 3, 4].map((n) => (
                <button key={n} className={snapshot.config.humans === n ? 'on' : ''} onClick={() => call('room:config', { config: { humans: n } })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {isHost ? (
        <button className="btn primary wide big" disabled={!allReady} onClick={() => call('room:start')}>
          {allReady ? t.start : t.waitingFor}
        </button>
      ) : (
        <button className={`btn wide big ${me.ready ? '' : 'primary'}`} onClick={() => call('room:ready', { ready: !me.ready })}>
          {me.ready ? `✓ ${t.ready} — waiting for host` : `I'm ready`}
        </button>
      )}
    </div>
  );
}
