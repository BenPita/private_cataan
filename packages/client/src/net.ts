import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Action, BotDifficulty, PlayerView } from '@hex/engine';

export interface RoomConfig {
  humans: number;
  bots: number;
  difficulty: BotDifficulty;
  botDifficulties: BotDifficulty[];
  victoryTarget: number;
  boardType: 'random' | 'beginner';
  startResBoth?: boolean;
}

export interface PublicSeat {
  kind: 'human' | 'bot';
  name: string | null;
  claimed: boolean;
  ready: boolean;
  connected: boolean;
  difficulty?: BotDifficulty;
}

export interface RoomSnapshot {
  id: string;
  status: 'lobby' | 'playing' | 'finished';
  config: RoomConfig;
  seats: PublicSeat[];
  revision: number;
  you: number;
  game: PlayerView | null;
}

export type Reply<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const socket: Socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });

let connected = socket.connected;
const listeners = new Set<() => void>();
socket.on('connect', () => {
  connected = true;
  listeners.forEach((l) => l());
});
socket.on('disconnect', () => {
  connected = false;
  listeners.forEach((l) => l());
});

export function useConnected(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => connected,
  );
}

export function emit<T = object>(event: string, payload: unknown = {}): Promise<Reply<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'No response from server' }), 10_000);
    socket.emit(event, payload, (res: Reply<T>) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

// --- Player tokens (one per room), kept on this device ---------------------

const tokenKey = (roomId: string) => `hex-token:${roomId}`;

export function saveToken(roomId: string, token: string) {
  try {
    localStorage.setItem(tokenKey(roomId), token);
  } catch {
    /* storage unavailable: the session still works until reload */
  }
}

export function loadToken(roomId: string): string | null {
  try {
    return localStorage.getItem(tokenKey(roomId));
  } catch {
    return null;
  }
}

export function forgetToken(roomId: string) {
  try {
    localStorage.removeItem(tokenKey(roomId));
  } catch {
    /* ignore */
  }
}

export interface ClosedInfo {
  reason: 'left' | 'inactive' | 'gone';
  by: string | null;
}

/** Leaves the game: it closes for everyone and is deleted on the server. */
export async function leaveGame(roomId: string) {
  await emit('room:leave');
  forgetToken(roomId);
}

export function rejoinLink(roomId: string): string | null {
  const token = loadToken(roomId);
  return token ? `${location.origin}/g/${roomId}#t=${token}` : null;
}

/** Live room state for this device's seat, resumed automatically on reconnect. */
export function useRoom(roomId: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'needs-join' | 'ready' | 'error' | 'closed'>('loading');
  const [closed, setClosed] = useState<ClosedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef<RoomSnapshot | null>(null);

  useEffect(() => {
    // A rejoin link carries the token in the URL hash (never sent to the server as a URL).
    const hash = new URLSearchParams(location.hash.slice(1));
    const fromHash = hash.get('t');
    if (fromHash) {
      saveToken(roomId, fromHash);
      history.replaceState(null, '', location.pathname);
    }

    const onState = (s: RoomSnapshot) => {
      if (s.id !== roomId) return;
      if (snapshotRef.current && s.revision < snapshotRef.current.revision) return;
      snapshotRef.current = s;
      setSnapshot(s);
      setStatus('ready');
    };
    socket.on('room:state', onState);
    const onClosed = (info: { roomId: string; reason: 'left' | 'inactive'; by: string | null }) => {
      if (info.roomId !== roomId) return;
      forgetToken(roomId);
      setClosed({ reason: info.reason, by: info.by });
      setStatus('closed');
    };
    socket.on('room:closed', onClosed);

    const resume = async () => {
      const token = loadToken(roomId);
      if (!token) {
        setStatus((st) => (st === 'ready' ? st : 'needs-join'));
        return;
      }
      const res = await emit('room:resume', { roomId, token });
      if (!res.ok) {
        if (res.error === 'Game not found') {
          forgetToken(roomId);
          setClosed((c) => c ?? { reason: 'gone', by: null });
          setStatus('closed');
        } else {
          setStatus('needs-join');
        }
      }
    };
    resume();
    socket.on('connect', resume);
    return () => {
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('connect', resume);
    };
  }, [roomId]);

  return { snapshot, status, error, closed, setStatus };
}

export const OUT_OF_DATE = 'Your game was out of date — please try again';

export async function sendAction(snapshot: RoomSnapshot, action: Action): Promise<Reply> {
  const res = await emit('game:action', {
    requestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    expectedRevision: snapshot.revision,
    action,
  });
  // This screen missed an update (e.g. after a short disconnect): fetch the
  // latest state right away so the next tap works.
  if (!res.ok && (res.error === OUT_OF_DATE || res.error === 'No response from server')) {
    const token = loadToken(snapshot.id);
    if (token) void emit('room:resume', { roomId: snapshot.id, token });
  }
  return res;
}
