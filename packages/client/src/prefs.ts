/** Small per-device preferences (tips). */
function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const tipsEnabled = () => read('hex-tips', 'on') === 'on';
export const setTipsEnabled = (on: boolean) => write('hex-tips', on ? 'on' : 'off');

export function seenTips(): Set<string> {
  try {
    return new Set(JSON.parse(read('hex-tips-seen', '[]')) as string[]);
  } catch {
    return new Set();
  }
}

export function markTipSeen(id: string) {
  const seen = seenTips();
  seen.add(id);
  write('hex-tips-seen', JSON.stringify([...seen]));
}

export function resetTips() {
  write('hex-tips-seen', '[]');
  setTipsEnabled(true);
}
