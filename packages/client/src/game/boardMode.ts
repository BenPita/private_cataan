export type BoardMode = '3d' | '2d';

/** True when this device can run the 3D board. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function getBoardMode(): BoardMode {
  try {
    const v = localStorage.getItem('hex-board');
    if (v === '2d' || v === '3d') return v === '3d' && !webglAvailable() ? '2d' : v;
  } catch {
    /* ignore */
  }
  return webglAvailable() ? '3d' : '2d';
}

export function saveBoardMode(mode: BoardMode) {
  try {
    localStorage.setItem('hex-board', mode);
  } catch {
    /* ignore */
  }
}
