/**
 * 3D board (three.js): the painted tiles become thick cardboard hexes inside a
 * sea frame resting on a wooden table, with wooden pieces, real shadows and a
 * tilted camera. Same props as the 2D board, so the game screen can swap them.
 *
 * Rendering is on demand: a frame is drawn only when something changed, the
 * camera moved, or an animation is running — important for phone batteries.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRAPH, type PlayerView } from '@hex/engine';
import { S, type BoardProps } from './Board';
import { createDice } from './dice3d';
import { diag } from '../diag';

const U = 1 / S; // board units -> world units (hex radius = 1)
const TILE_R = 0.965;
const TILE_H = 0.12;
const FRAME_TOP = 0;
const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

const w = (x: number, y: number, h = 0) => new THREE.Vector3(x * U, h, y * U);

/** Phones get a much lighter renderer: their GPUs drop the WebGL context under load. */
export const IS_MOBILE =
  typeof navigator !== 'undefined' && (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);

/** Lambert shading: far cheaper than physically based materials, fine for painted textures. */
const lit = (p: { map?: THREE.Texture; color?: string }) => new THREE.MeshLambertMaterial(p);

// ---------------------------------------------------------------------------
// Geometry helpers

/** Flat polygon (in the XZ plane) with planar UVs: u = x / width, v = -z / depth. */
function fanGeometry(points: Array<[number, number]>, uvW: number, uvD: number): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const uv: number[] = [0.5, 0.5];
  for (const [x, z] of points) {
    pos.push(x, 0, z);
    uv.push(x / uvW + 0.5, 0.5 - z / uvD);
  }
  const idx: number[] = [];
  for (let i = 1; i <= points.length; i++) idx.push(0, i === points.length ? 1 : i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const hexPoints = (r: number, offsetDeg = -90): Array<[number, number]> =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i + offsetDeg) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

const circlePoints = (r: number, n = 40): Array<[number, number]> =>
  Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)]);

function houseGeometry(): THREE.BufferGeometry {
  const base = new THREE.BoxGeometry(0.22, 0.15, 0.2);
  base.translate(0, 0.075, 0);
  const roofShape = new THREE.Shape([new THREE.Vector2(-0.135, 0), new THREE.Vector2(0.135, 0), new THREE.Vector2(0, 0.13)]);
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 0.22, bevelEnabled: false });
  roof.translate(0, 0.15, -0.11);
  return mergeGeometries([base.toNonIndexed(), roof.toNonIndexed()]);
}

function cityGeometry(): THREE.BufferGeometry {
  const hall = new THREE.BoxGeometry(0.34, 0.15, 0.22);
  hall.translate(0.04, 0.075, 0);
  const tower = new THREE.BoxGeometry(0.16, 0.28, 0.22);
  tower.translate(-0.09, 0.14, 0);
  const roofShape = new THREE.Shape([new THREE.Vector2(-0.1, 0), new THREE.Vector2(0.1, 0), new THREE.Vector2(0, 0.12)]);
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 0.24, bevelEnabled: false });
  roof.translate(-0.09, 0.28, -0.12);
  return mergeGeometries([hall.toNonIndexed(), tower.toNonIndexed(), roof.toNonIndexed()]);
}

function pawnGeometry(): THREE.BufferGeometry {
  const pts = [
    [0, 0],
    [0.15, 0],
    [0.16, 0.03],
    [0.12, 0.06],
    [0.1, 0.2],
    [0.06, 0.3],
    [0.09, 0.34],
    [0.06, 0.37],
    [0.1, 0.43],
    [0.09, 0.5],
    [0.05, 0.54],
    [0, 0.55],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}

// ---------------------------------------------------------------------------
// Canvas textures (number discs and harbor flags)

function discTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(100, 90, 20, 128, 128, 128);
  grad.addColorStop(0, '#fdf3d6');
  grad.addColorStop(0.75, '#efdcab');
  grad.addColorStop(1, '#d1b577');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(140,110,60,0.6)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.stroke();
  const red = n === 6 || n === 8;
  g.fillStyle = red ? '#b3261a' : '#2a1e14';
  g.font = `900 ${red ? 132 : 122}px "Frank Ruhl Libre", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 128, 116);
  const pips = PIPS[n];
  for (let i = 0; i < pips; i++) {
    g.beginPath();
    g.arc(128 + (i - (pips - 1) / 2) * 18, 196, 6.5, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = IS_MOBILE ? 1 : 4;
  return t;
}

function flagTexture(type: string, onUpdate: () => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 150;
  const g = c.getContext('2d')!;
  const draw = (img?: HTMLImageElement) => {
    g.clearRect(0, 0, 200, 150);
    g.fillStyle = '#f7ecd0';
    g.strokeStyle = '#7a5a2a';
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(6, 6, 188, 138, 16);
    g.fill();
    g.stroke();
    if (img) g.drawImage(img, 22, 18, 58, 81);
    g.fillStyle = '#3b2412';
    g.font = '900 64px "Frank Ruhl Libre", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (type === 'generic') {
      g.fillText('3:1', 100, 70);
      g.font = '900 34px "Frank Ruhl Libre", Georgia, serif';
      g.fillText('?', 100, 122);
    } else {
      g.fillText('2:1', 138, 62);
    }
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (type !== 'generic') {
    const img = new Image();
    img.onload = () => {
      draw(img);
      t.needsUpdate = true;
      onUpdate();
    };
    img.src = `/art/card-${type}.webp`;
  }
  return t;
}

// ---------------------------------------------------------------------------

interface Tween {
  update(t: number): boolean; // returns false when finished
  /** Purely visual pulse/glow: needs redraws but not new shadows. */
  ambient?: boolean;
}

export default function Board3D({
  view,
  targets,
  selection,
  onSelect,
  highlightHexes,
  onInspectHex,
  apiRef,
  onGiveUp,
}: BoardProps & { onGiveUp?: () => void }) {
  const lossTimes = useRef<number[]>([]);
  const giveUpRef = useRef(onGiveUp);
  giveUpRef.current = onGiveUp;
  const mountRef = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);
  const propsRef = useRef({ onSelect, onInspectHex, targets });
  propsRef.current = { onSelect, onInspectHex, targets };

  // Bumped when the phone drops the GPU context, so the whole 3D scene is rebuilt.
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const e = createEngine(
      mountRef.current!,
      (hit) => {
        const { onSelect: select, onInspectHex: inspect, targets: tg } = propsRef.current;
        if (!hit) return;
        if (hit.kind === 'hex' && !(tg.hexes ?? []).includes(hit.id as number)) inspect?.(hit.id as number);
        else select(hit as never);
      },
      () => {
        // A second GPU loss within two minutes means this phone can't keep the
        // 3D board alive: hand over to the 2D board instead of flashing white.
        const now = Date.now();
        lossTimes.current = [...lossTimes.current.filter((t) => now - t < 120_000), now];
        if (lossTimes.current.length >= 2 && giveUpRef.current) {
          diag('3d-fallback-2d', `${lossTimes.current.length} losses`);
          giveUpRef.current();
        } else {
          setEpoch((n) => n + 1);
        }
      },
    );
    engine.current = e;
    if (epoch > 0) diag('3d-rebuilt', `epoch ${epoch}`);
    if (apiRef) apiRef.current = { project: e.project, rollDice: e.rollDice };
    return () => {
      e.dispose();
      engine.current = null;
    };
  }, [epoch]);

  useEffect(() => engine.current?.setBoard(view), [epoch, JSON.stringify(view.board.hexes), JSON.stringify(view.board.harbors)]);
  useEffect(() => engine.current?.setPieces(view), [epoch, view.buildings, view.roads, view.players.length]);
  useEffect(() => engine.current?.setRobber(view.board.robberHex), [epoch, view.board.robberHex]);
  useEffect(
    () => engine.current?.setTargets(targets, selection, view.players[view.me ?? 0]?.color ?? '#ffffff'),
    [epoch, targets, selection],
  );
  useEffect(() => engine.current?.setHighlight(highlightHexes), [epoch, highlightHexes]);

  return <div ref={mountRef} className="board-3d" />;
}

type Hit = { kind: 'vertex' | 'edge' | 'hex'; id: string | number };

function createEngine(mount: HTMLDivElement, onPick: (hit: Hit | null) => void, onContextRestored: () => void) {
  // Diagnostics from a Mali phone showed the GPU dropping the WebGL context every
  // few seconds under the old settings, so phones get a deliberately light setup.
  const renderer = new THREE.WebGLRenderer({
    antialias: !IS_MOBILE,
    alpha: false,
    powerPreference: 'default',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // shadows are re-rendered only when pieces change
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b1a0d');

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0.15);
  controls.enablePan = false;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.05;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;

  // Light: warm sun with soft shadows, sky/ground fill.
  scene.add(new THREE.HemisphereLight('#dff1ff', '#8a6a40', 1.05));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.1);
  sun.position.set(-4, 11, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(IS_MOBILE ? 512 : 1024, IS_MOBILE ? 512 : 1024);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const loader = new THREE.TextureLoader();
  const maxAniso = IS_MOBILE ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const tex = (url: string, repeat?: number) => {
    const t = loader.load(url, () => invalidate());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
    }
    return t;
  };

  // Table
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    lit({ map: tex('/art/wood.webp', 14) }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.16;
  table.receiveShadow = true;
  scene.add(table);

  // Sea frame: a flat-topped hexagonal plate with the painted sea and beach on top.
  const FRAME_R = 5.45;
  const VIEW = 10.6;
  const frameTop = new THREE.Mesh(
    fanGeometry(hexPoints(FRAME_R, 0), VIEW, VIEW),
    lit({ map: tex('/art/sea.webp') }),
  );
  frameTop.position.y = FRAME_TOP;
  frameTop.receiveShadow = true;
  const frameSide = new THREE.Mesh(
    new THREE.CylinderGeometry(FRAME_R, FRAME_R, 0.16, 6, 1, true),
    lit({ color: '#155f7c' }),
  );
  frameSide.rotation.y = Math.PI / 6;
  frameSide.position.y = -0.08;
  frameSide.castShadow = true;
  scene.add(frameTop, frameSide);

  const tilesGroup = new THREE.Group();
  const discsGroup = new THREE.Group();
  const harborsGroup = new THREE.Group();
  const piecesGroup = new THREE.Group();
  const targetsGroup = new THREE.Group();
  scene.add(tilesGroup, discsGroup, harborsGroup, piecesGroup, targetsGroup);

  const tileGeo = fanGeometry(hexPoints(TILE_R), Math.sqrt(3) * TILE_R, 2 * TILE_R);
  const tileSideGeo = new THREE.CylinderGeometry(TILE_R, TILE_R, TILE_H, 6, 1, true);
  const tileSideMat = lit({ color: '#6e5232' });
  const tileMats = new Map<number, THREE.MeshLambertMaterial>();
  const tileTops: THREE.Mesh[] = [];
  const texCache = new Map<string, THREE.Texture>();
  const cachedTex = (url: string) => {
    if (!texCache.has(url)) texCache.set(url, tex(url));
    return texCache.get(url)!;
  };

  const houseGeo = houseGeometry();
  const cityGeo = cityGeometry();
  const roadGeo = new THREE.BoxGeometry(0.6, 0.085, 0.1);
  roadGeo.translate(0, 0.0425, 0);
  const pieceMats = new Map<string, THREE.MeshLambertMaterial>();
  const pieceMat = (color: string) => {
    if (!pieceMats.has(color)) pieceMats.set(color, lit({ color }));
    return pieceMats.get(color)!;
  };

  const robber = new THREE.Mesh(pawnGeometry(), lit({ color: '#9aa0a6' }));
  robber.castShadow = true;
  robber.scale.setScalar(1.3);
  scene.add(robber);

  // --- Render loop (on demand) --------------------------------------------------
  // Frames are drawn when something changed, for a short burst afterwards
  // (mobile compositors can drop a single frame), and once a second as a
  // safety net. Idle cost stays tiny.
  let renderUntil = 0;
  /** Frames left in which the shadow map must be re-rendered (pieces moved). */
  let shadowsDirty = 2;
  const dirtyShadows = (frames = 2) => {
    shadowsDirty = Math.max(shadowsDirty, frames);
  };
  let lastRender = 0;
  let lost = false;
  let lostAt = 0;
  let rebuilding = false;
  let lastLostCheck = 0;
  const gl = renderer.getContext();
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    diag('3d-start', `${info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'gpu?'} dpr=${window.devicePixelRatio} mobile=${IS_MOBILE} light-v2`);
  } catch {
    /* ignore */
  }
  const tweens = new Set<Tween>();
  const invalidate = () => {
    renderUntil = Math.max(renderUntil, performance.now() + 400);
  };
  controls.addEventListener('change', invalidate);
  let raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (lost) {
      // The browser took the GPU context away. If it has not come back within
      // a moment, build a brand-new canvas instead of showing a blank board.
      if (now - lostAt > 50 && !rebuilding) {
        rebuilding = true;
        diag('3d-rebuild', 'context not restored');
        onContextRestored();
      }
      return;
    }
    // Belt and braces: some phones report loss only through isContextLost().
    if (now - lastLostCheck > 1000) {
      lastLostCheck = now;
      if (gl.isContextLost()) {
        lost = true;
        lostAt = now;
        diag('3d-lost', 'detected by poll');
        return;
      }
    }
    if (tweens.size) {
      for (const tw of tweens) if (!tw.ambient) dirtyShadows(1);
      for (const tw of [...tweens]) {
        try {
          if (!tw.update(now)) tweens.delete(tw);
        } catch (err) {
          console.error('3D animation failed', err);
          tweens.delete(tw);
        }
      }
      invalidate();
    }
    if (now > renderUntil && now - lastRender < 1000) return;
    // Pulsing markers and glows don't need 60 fps: cap phones at ~30 fps.
    if (IS_MOBILE && now - lastRender < 32) return;
    lastRender = now;
    if (shadowsDirty > 0) {
      renderer.shadowMap.needsUpdate = true;
      shadowsDirty--;
    }
    try {
      renderer.render(scene, camera);
    } catch (err) {
      console.error('3D render failed', err);
      diag('3d-render-error', String((err as Error)?.message ?? err));
    }
  };
  raf = requestAnimationFrame(loop);

  // Redraw (with a fresh surface) when the page comes back: app switch,
  // screen unlock, back/forward cache, system overlays such as the volume panel.
  const wake = () => invalidate();
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('focus', wake);
  window.addEventListener('orientationchange', wake);
  window.addEventListener('blur', wake);
  window.visualViewport?.addEventListener('resize', wake);

  // The phone may drop the GPU context under memory pressure: let the browser
  // restore it and rebuild the scene instead of leaving a blank board.
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    lostAt = performance.now();
    diag('3d-lost', 'event');
  };
  const onRestored = () => {
    diag('3d-restored');
    if (!rebuilding) {
      rebuilding = true;
      onContextRestored();
    }
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);

  const tween = (duration: number, step: (k: number) => void, delay = 0) => {
    const start = performance.now() + delay;
    tweens.add({
      update(t) {
        const k = Math.min(1, Math.max(0, (t - start) / duration));
        step(k);
        return k < 1;
      },
    });
  };

  const dice = createDice(scene, TILE_H, (ms) => tween(ms, () => {}));

  // --- Sizing & camera framing ------------------------------------------------
  let framed = false;
  const resize = () => {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!framed) {
      framed = true;
      const vfov = (camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const fitW = 5.6 / Math.tan(hfov / 2);
      const fitH = 4.6 / Math.tan(vfov / 2);
      const dist = Math.max(fitW, fitH) * 0.94;
      const polar = 0.5;
      camera.position.set(0, Math.cos(polar) * dist, Math.sin(polar) * dist + 0.15);
      controls.minDistance = dist * 0.4;
      controls.maxDistance = dist * 1.35;
      controls.update();
    }
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  // --- Picking ----------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  let down: { x: number; y: number } | null = null;
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
      down = null;
      return;
    }
    down = null;
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...targetsGroup.children, ...tileTops], false);
    const hit = hits.find((h) => h.object.userData.pick);
    onPick(hit ? (hit.object.userData.pick as Hit) : null);
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('dblclick', () => {
    framed = false;
    resize();
  });

  const project = (x: number, y: number) => {
    const v = w(x, y, TILE_H).project(camera);
    const rect = el.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  };

  // --- Board content --------------------------------------------------------------
  function clear(group: THREE.Group, dispose = true) {
    for (const child of [...group.children]) {
      group.remove(child);
      if (!dispose) continue;
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && m.geometry !== tileGeo && m.geometry !== tileSideGeo && m.geometry !== houseGeo && m.geometry !== cityGeo && m.geometry !== roadGeo) {
          m.geometry.dispose();
        }
      });
    }
  }

  function setBoard(view: PlayerView) {
    dirtyShadows(3);
    clear(tilesGroup);
    clear(discsGroup);
    clear(harborsGroup);
    tileTops.length = 0;
    tileMats.clear();
    const discSide = lit({ color: '#d9c08a' });
    const discTop = new Map<number, THREE.MeshLambertMaterial>();
    for (const tile of view.board.hexes) {
      const g = GRAPH.hexes[tile.id];
      const mat = lit({ map: cachedTex(`/art/hex-${tile.terrain}-${tile.id % 2}.webp`) });
      tileMats.set(tile.id, mat);
      const top = new THREE.Mesh(tileGeo, mat);
      top.position.set(g.x, FRAME_TOP + TILE_H, g.y);
      top.receiveShadow = true;
      top.userData.pick = { kind: 'hex', id: tile.id };
      const side = new THREE.Mesh(tileSideGeo, tileSideMat);
      side.position.set(g.x, FRAME_TOP + TILE_H / 2, g.y);
      side.castShadow = true;
      side.receiveShadow = true;
      tilesGroup.add(top, side);
      tileTops.push(top);

      if (tile.number !== null) {
        if (!discTop.has(tile.number)) {
          discTop.set(tile.number, lit({ map: discTexture(tile.number) }));
        }
        const r = 0.37;
        const dTop = new THREE.Mesh(fanGeometry(circlePoints(r), 2 * r, 2 * r), discTop.get(tile.number)!);
        dTop.position.set(g.x, TILE_H + 0.035, g.y);
        dTop.receiveShadow = true;
        const dSide = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.035, 40, 1, true), discSide);
        dSide.position.set(g.x, TILE_H + 0.0175, g.y);
        dSide.castShadow = true;
        discsGroup.add(dTop, dSide);
      }
    }

    // Harbors: two wooden piers and a flag on a pole.
    const plankMat = lit({ color: '#9b6a38' });
    const poleMat = lit({ color: '#4a2c12' });
    for (const h of view.board.harbors) {
      const e = GRAPH.edges[h.edge];
      const hex = GRAPH.hexes[e.hexes[0]];
      const dx = e.x - hex.x;
      const dy = e.y - hex.y;
      const len = Math.hypot(dx, dy);
      const px = e.x + (dx / len) * 0.62;
      const py = e.y + (dy / len) * 0.62;
      for (const vid of e.vertices) {
        const v = GRAPH.vertices[vid];
        const l = Math.hypot(px - v.x, py - v.y);
        const pier = new THREE.Mesh(new THREE.BoxGeometry(l, 0.04, 0.12), plankMat);
        pier.position.set((v.x + px) / 2, 0.03, (v.y + py) / 2);
        pier.rotation.y = -Math.atan2(py - v.y, px - v.x);
        pier.castShadow = true;
        pier.receiveShadow = true;
        harborsGroup.add(pier);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8), poleMat);
      pole.position.set(px, 0.31, py);
      pole.castShadow = true;
      const flag = new THREE.Sprite(new THREE.SpriteMaterial({ map: flagTexture(h.type, invalidate), transparent: true }));
      flag.scale.set(0.66, 0.5, 1);
      flag.position.set(px, 0.8, py);
      harborsGroup.add(pole, flag);
    }
    invalidate();
  }

  const pieceMeshes = new Map<string, THREE.Mesh>();
  function setPieces(view: PlayerView) {
    dirtyShadows(3);
    const wanted = new Map<string, { make: () => THREE.Mesh }>();
    const colors = view.players.map((p) => p.color);
    for (const [vertex, b] of Object.entries(view.buildings)) {
      const v = GRAPH.vertices[vertex];
      wanted.set(`b:${vertex}:${b.type}:${b.owner}`, {
        make: () => {
          const m = new THREE.Mesh(b.type === 'city' ? cityGeo : houseGeo, pieceMat(colors[b.owner]));
          m.scale.setScalar(1.45);
          m.position.set(v.x, TILE_H, v.y);
          m.rotation.y = ((v.x * 7 + v.y * 3) % 1) * 0.6 - 0.3;
          return m;
        },
      });
    }
    for (const [edge, owner] of Object.entries(view.roads)) {
      const e = GRAPH.edges[edge];
      const [a, b] = e.vertices.map((id) => GRAPH.vertices[id]);
      wanted.set(`r:${edge}:${owner}`, {
        make: () => {
          const m = new THREE.Mesh(roadGeo, pieceMat(colors[owner]));
          m.scale.set(1, 1.4, 1.4);
          m.position.set(e.x, TILE_H, e.y);
          m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
          return m;
        },
      });
    }
    const firstFill = pieceMeshes.size === 0;
    for (const [key, mesh] of pieceMeshes) {
      if (!wanted.has(key)) {
        piecesGroup.remove(mesh);
        pieceMeshes.delete(key);
      }
    }
    for (const [key, spec] of wanted) {
      if (pieceMeshes.has(key)) continue;
      const m = spec.make();
      m.castShadow = true;
      m.receiveShadow = true;
      piecesGroup.add(m);
      pieceMeshes.set(key, m);
      if (!firstFill && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const restY = m.position.y;
        m.position.y = restY + 1.4;
        tween(420, (k) => {
          // Drop with a small bounce.
          const bounce = k < 0.75 ? 1 - (k / 0.75) ** 2 : Math.sin(((k - 0.75) / 0.25) * Math.PI) * 0.06;
          m.position.y = restY + Math.max(0, bounce) * (k < 0.75 ? 1.4 : 1);
        });
      }
    }
    invalidate();
  }

  let robberHex = -1;
  function setRobber(hex: number) {
    dirtyShadows(3);
    const g = GRAPH.hexes[hex];
    const to = new THREE.Vector3(g.x + 0.42, TILE_H, g.y - 0.2);
    if (robberHex < 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      robber.position.copy(to);
    } else {
      const from = robber.position.clone();
      tween(650, (k) => {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        robber.position.lerpVectors(from, to, e);
        robber.position.y = TILE_H + Math.sin(k * Math.PI) * 0.8;
      });
    }
    robberHex = hex;
    invalidate();
  }

  const vertexHitGeo = new THREE.SphereGeometry(0.2, 12, 8);
  const vertexMarkGeo = new THREE.TorusGeometry(0.15, 0.055, 10, 28);
  const edgeHitGeo = new THREE.BoxGeometry(0.62, 0.2, 0.28);
  const edgeMarkGeo = new THREE.BoxGeometry(0.5, 0.07, 0.2);
  const edgeOutlineGeo = new THREE.BoxGeometry(0.58, 0.05, 0.3);
  const vertexOutlineGeo = new THREE.TorusGeometry(0.15, 0.09, 10, 28);
  const hexRingGeo = new THREE.TorusGeometry(0.82, 0.035, 6, 6);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  let pulse: Tween | null = null;

  function setTargets(targets: BoardProps['targets'], selection: BoardProps['selection'], myColor: string) {
    clear(targetsGroup, false);
    if (pulse) tweens.delete(pulse);
    const marks: THREE.Mesh[] = [];
    const markMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95, depthTest: false });
    const outlineMat = new THREE.MeshBasicMaterial({ color: '#2a1606', transparent: true, opacity: 0.6, depthTest: false });
    const selMat = new THREE.MeshBasicMaterial({ color: myColor, depthTest: false });
    for (const vid of targets.vertices ?? []) {
      const v = GRAPH.vertices[vid];
      const hit = new THREE.Mesh(vertexHitGeo, hitMat);
      hit.position.set(v.x, TILE_H + 0.05, v.y);
      hit.userData.pick = { kind: 'vertex', id: vid };
      const selected = selection?.kind === 'vertex' && selection.id === vid;
      const mark = new THREE.Mesh(vertexMarkGeo, selected ? selMat : markMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(v.x, TILE_H + 0.07, v.y);
      if (selected) mark.scale.setScalar(1.5);
      const outline = new THREE.Mesh(vertexOutlineGeo, outlineMat);
      outline.rotation.x = -Math.PI / 2;
      outline.position.set(v.x, TILE_H + 0.065, v.y);
      outline.renderOrder = 1;
      mark.renderOrder = 2;
      targetsGroup.add(hit, outline, mark);
      marks.push(mark);
    }
    for (const eid of targets.edges ?? []) {
      const e = GRAPH.edges[eid];
      const [a, b] = e.vertices.map((id) => GRAPH.vertices[id]);
      const angle = -Math.atan2(b.y - a.y, b.x - a.x);
      const hit = new THREE.Mesh(edgeHitGeo, hitMat);
      hit.position.set(e.x, TILE_H + 0.05, e.y);
      hit.rotation.y = angle;
      hit.userData.pick = { kind: 'edge', id: eid };
      const selected = selection?.kind === 'edge' && selection.id === eid;
      const mark = new THREE.Mesh(edgeMarkGeo, selected ? selMat : markMat);
      mark.position.set(e.x, TILE_H + 0.06, e.y);
      mark.rotation.y = angle;
      const outline = new THREE.Mesh(edgeOutlineGeo, outlineMat);
      outline.position.set(e.x, TILE_H + 0.055, e.y);
      outline.rotation.y = angle;
      outline.renderOrder = 1;
      mark.renderOrder = 2;
      targetsGroup.add(hit, outline, mark);
      marks.push(mark);
    }
    for (const hid of targets.hexes ?? []) {
      const g = GRAPH.hexes[hid];
      const selected = selection?.kind === 'hex' && selection.id === hid;
      const ring = new THREE.Mesh(hexRingGeo, selected ? selMat : markMat);
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.PI / 2;
      ring.position.set(g.x, TILE_H + 0.02, g.y);
      targetsGroup.add(ring);
      marks.push(ring);
    }
    if (marks.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const start = performance.now();
      pulse = {
        ambient: true,
        update(t) {
          const k = 0.5 + 0.5 * Math.sin((t - start) / 220);
          markMat.opacity = 0.7 + 0.3 * k;
          for (const m of marks) if (m.material === markMat) m.scale.setScalar(1 + 0.18 * k);
          return true;
        },
      };
      tweens.add(pulse);
    }
    invalidate();
  }

  let glow: Tween | null = null;
  function setHighlight(hexes: number[]) {
    for (const m of tileMats.values()) m.emissive.set('#000000');
    if (glow) tweens.delete(glow);
    if (!hexes.length) {
      invalidate();
      return;
    }
    const start = performance.now();
    glow = {
      ambient: true,
      update(t) {
        const k = 0.5 + 0.5 * Math.sin((t - start) / 140);
        for (const h of hexes) {
          const m = tileMats.get(h);
          if (m) m.emissive.setRGB(0.45 * k, 0.4 * k, 0.2 * k);
        }
        return true;
      },
    };
    tweens.add(glow);
  }

  function dispose() {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('pageshow', wake);
    window.removeEventListener('focus', wake);
    window.removeEventListener('orientationchange', wake);
    window.removeEventListener('blur', wake);
    window.visualViewport?.removeEventListener('resize', wake);
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
    dice.dispose();
    ro.disconnect();
    controls.dispose();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    renderer.dispose();
    texCache.forEach((t) => t.dispose());
    mount.removeChild(el);
  }

  return { setBoard, setPieces, setRobber, setTargets, setHighlight, project, dispose, rollDice: dice.roll };
}

