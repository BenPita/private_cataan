/**
 * Tiny diagnostics channel: technical events from this device (graphics
 * context loss, render errors, page visibility) are sent to the server so
 * problems that only happen on a real phone can be investigated. No personal
 * data is sent — only the event name, a short detail and the browser type.
 */
import { socket } from './net';

let sent = 0;

export function diag(event: string, detail = '') {
  if (sent++ > 200) return; // never flood
  try {
    socket.emit('client:diag', { event: event.slice(0, 60), detail: String(detail).slice(0, 300), t: Date.now() });
  } catch {
    /* ignore */
  }
}

let installed = false;
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => diag('error', `${e.message} @${e.filename?.split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => diag('rejection', String((e.reason as Error)?.message ?? e.reason)));
  document.addEventListener('visibilitychange', () => diag('visibility', document.visibilityState));
}
