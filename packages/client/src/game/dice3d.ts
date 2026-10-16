/**
 * Physical 3D dice. The server decides the result; here we run a real
 * physics simulation (cannon-es) of two dice thrown onto the board, record it,
 * then paint the faces so that the server's numbers end up facing upward.
 * Playback is the recorded motion, so it always lands on the true result.
 */
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sfx } from '../sound';

const SIZE = 0.58;
const FPS = 60;

/** BoxGeometry material order: +x, -x, +y, -y, +z, -z. Local normals for each slot: */
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];
const OPPOSITE = [1, 0, 3, 2, 5, 4];

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
};

function faceTexture(value: number, body: string, pip: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = body;
  g.fillRect(0, 0, 128, 128);
  for (const [x, y] of PIPS[value]) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.arc(x * 128 + 2, y * 128 + 3, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pip;
    g.beginPath();
    g.arc(x * 128, y * 128, 12, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Recording {
  frames: Array<Array<{ p: CANNON.Vec3; q: CANNON.Quaternion }>>;
  hits: Array<{ frame: number; strength: number }>;
}

/** Simulates a throw (no rendering) and records every frame. */
export function simulate(floorY: number): Recording {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -26, 0) });
  world.allowSleep = true;
  const diceMat = new CANNON.Material('dice');
  const floorMat = new CANNON.Material('floor');
  world.addContactMaterial(new CANNON.ContactMaterial(diceMat, floorMat, { friction: 0.32, restitution: 0.38 }));
  world.addContactMaterial(new CANNON.ContactMaterial(diceMat, diceMat, { friction: 0.2, restitution: 0.45 }));

  const floor = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floor.position.y = floorY;
  world.addBody(floor);
  // Invisible walls keep the dice on the island.
  const wall = (x: number, z: number, rotY: number) => {
    const b = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Plane() });
    b.quaternion.setFromEuler(0, rotY, 0);
    b.position.set(x, 0, z);
    world.addBody(b);
  };
  wall(-2.6, 0, Math.PI / 2);
  wall(2.6, 0, -Math.PI / 2);
  wall(0, -2.2, 0);
  wall(0, 3.2, Math.PI);

  const hits: Recording['hits'] = [];
  let step = 0;
  const bodies = [-0.45, 0.45].map((offset) => {
    const b = new CANNON.Body({
      mass: 1,
      material: diceMat,
      shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)),
      linearDamping: 0.08,
      angularDamping: 0.12,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.25,
    });
    b.position.set(offset + (Math.random() - 0.5) * 0.4, floorY + 1.6 + Math.random() * 0.4, 3.0);
    b.velocity.set((Math.random() - 0.5) * 2.5 - offset * 1.5, 1.5 + Math.random(), -7 - Math.random() * 2.5);
    b.angularVelocity.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    b.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    b.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.2) hits.push({ frame: step, strength: Math.min(1, v / 9) });
    });
    world.addBody(b);
    return b;
  });

  const frames: Recording['frames'] = [];
  for (step = 0; step < FPS * 4; step++) {
    world.step(1 / FPS);
    frames.push(bodies.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone() })));
    if (step > 30 && bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING)) break;
  }
  return { frames, hits };
}

/** A throw is usable when both dice lie flat on the board (not stacked or leaning). */
function settledFlat(rec: Recording, floorY: number): boolean {
  const last = rec.frames[rec.frames.length - 1];
  return last.every((s) => {
    const quat = new THREE.Quaternion(s.q.x, s.q.y, s.q.z, s.q.w);
    const up = Math.max(...FACE_NORMALS.map((n) => n.clone().applyQuaternion(quat).y));
    return s.p.y < floorY + SIZE / 2 + 0.05 && up > 0.97;
  });
}

/** Simulates until the dice land flat (re-throwing invisibly if needed). */
export function simulateFlat(floorY: number): Recording {
  let rec = simulate(floorY);
  for (let i = 0; i < 8 && !settledFlat(rec, floorY); i++) rec = simulate(floorY);
  return rec;
}

/** Which material slot ends up facing upward for a final orientation. */
export function topSlot(q: CANNON.Quaternion): number {
  const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  let best = 0;
  let bestY = -Infinity;
  FACE_NORMALS.forEach((n, i) => {
    const y = n.clone().applyQuaternion(quat).y;
    if (y > bestY) {
      bestY = y;
      best = i;
    }
  });
  return best;
}

/** Face values per slot so `value` is on `top` and opposite faces add up to 7. */
export function faceValues(top: number, value: number): number[] {
  const values = new Array<number>(6);
  values[top] = value;
  values[OPPOSITE[top]] = 7 - value;
  const rest = [1, 2, 3, 4, 5, 6].filter((v) => v !== value && v !== 7 - value);
  const slots = [0, 2, 4].filter((s) => s !== top && s !== OPPOSITE[top]);
  // Pair the remaining values on the remaining opposite slots.
  values[slots[0]] = rest[0];
  values[OPPOSITE[slots[0]]] = 7 - rest[0];
  const other = rest.find((v) => v !== rest[0] && v !== 7 - rest[0])!;
  values[slots[1]] = other;
  values[OPPOSITE[slots[1]]] = 7 - other;
  return values;
}

export function createDice(scene: THREE.Scene, floorY: number, requestFrames: (ms: number) => void) {
  const geometry = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.07);
  const textures = {
    red: [1, 2, 3, 4, 5, 6].map((v) => faceTexture(v, '#c9301f', '#fff6e6')),
    yellow: [1, 2, 3, 4, 5, 6].map((v) => faceTexture(v, '#f2c230', '#b3261a')),
  };
  const meshes = (['red', 'yellow'] as const).map((tone) => {
    // Each face starts with a texture, so the shader is built once here; a roll
    // only swaps textures (no shader rebuild on the GPU in the middle of a turn).
    const mats = Array.from({ length: 6 }, (_, slot) => new THREE.MeshStandardMaterial({ map: textures[tone][slot], roughness: 0.35, metalness: 0.05 }));
    const m = new THREE.Mesh(geometry, mats);
    m.castShadow = true;
    m.visible = false;
    scene.add(m);
    return { mesh: m, mats, tone };
  });

  let playing: number | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function roll(values: [number, number]): Promise<void> {
    if (playing !== null) cancelAnimationFrame(playing);
    if (hideTimer) clearTimeout(hideTimer);
    const rec = simulateFlat(floorY);
    const last = rec.frames[rec.frames.length - 1];
    meshes.forEach((d, i) => {
      const vals = faceValues(topSlot(last[i].q), values[i]);
      d.mats.forEach((mat, slot) => {
        mat.map = textures[d.tone][vals[slot] - 1];
      });
      d.mesh.visible = true;
      d.mesh.scale.setScalar(1);
    });
    sfx.diceShake();
    const hitQueue = [...rec.hits];
    const durationMs = (rec.frames.length / FPS) * 1000;
    requestFrames(durationMs + 200);
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const frame = Math.min(rec.frames.length - 1, Math.floor(((performance.now() - start) / 1000) * FPS));
        rec.frames[frame].forEach((s, i) => {
          meshes[i].mesh.position.set(s.p.x, s.p.y, s.p.z);
          meshes[i].mesh.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w);
        });
        while (hitQueue.length && hitQueue[0].frame <= frame) sfx.diceHit(hitQueue.shift()!.strength);
        if (frame < rec.frames.length - 1) {
          playing = requestAnimationFrame(tick);
        } else {
          playing = null;
          resolve();
          // Leave the dice on the table for a moment, then clear them away.
          hideTimer = setTimeout(() => {
            const t0 = performance.now();
            requestFrames(350);
            const shrink = () => {
              const k = Math.min(1, (performance.now() - t0) / 300);
              meshes.forEach((d) => d.mesh.scale.setScalar(1 - k));
              if (k < 1) requestAnimationFrame(shrink);
              else meshes.forEach((d) => (d.mesh.visible = false));
            };
            shrink();
          }, 3200);
        }
      };
      playing = requestAnimationFrame(tick);
    });
  }

  function dispose() {
    if (playing !== null) cancelAnimationFrame(playing);
    if (hideTimer) clearTimeout(hideTimer);
    geometry.dispose();
    meshes.forEach((d) => d.mats.forEach((m) => m.dispose()));
    Object.values(textures).flat().forEach((t) => t.dispose());
  }

  return { roll, dispose };
}
