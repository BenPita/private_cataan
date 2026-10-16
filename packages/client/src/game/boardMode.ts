export type BoardMode = '3d' | '2d';

let webgl: boolean | null = null;

/**
 * True when this device can run the 3D board. Probed once per page load: every
 * probe creates a WebGL context, and phones allow only a few at a time — when
 * the limit is exceeded the browser kills the oldest one, which is the board's
 * (the board then turns white). The probe context is released right away.
 */
export function webglAvailable(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
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
