import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent } from 'react';
import { GRAPH, type PlayerView } from '@hex/engine';
import { ResourceGlyph, shade } from '../art';

/** SVG units per hex radius. Must match art-src/extras.py (sea frame). */
export const S = 60;
const VIEW = 10.6 * S;
const TILE_R = S * 0.965; // a little smaller than the grid, so sandy seams show between tiles
const TILE_W = Math.sqrt(3) * TILE_R;
const TILE_H = 2 * TILE_R;

export type Selection =
  | { kind: 'vertex'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'hex'; id: number }
  | null;

export interface BoardTargets {
  vertices?: string[];
  edges?: string[];
  hexes?: number[];
}

/** Lets effects find where a board point (in SVG board units) is on screen. */
export interface BoardApi {
  project(x: number, y: number): { x: number; y: number } | null;
  /** Present on the 3D board: throws physical dice that land on these values. */
  rollDice?(values: [number, number]): Promise<void>;
}

export interface BoardProps {
  view: PlayerView;
  targets: BoardTargets;
  selection: Selection;
  onSelect: (s: Selection) => void;
  highlightHexes: number[];
  onInspectHex?: (hex: number) => void;
  /** Filled in by the board so effects can map board points to the screen. */
  apiRef?: React.MutableRefObject<BoardApi | null>;
}

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

function Defs() {
  return (
    <defs>
      <radialGradient id="disc" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stopColor="#fdf3d6" />
        <stop offset="70%" stopColor="#efdcab" />
        <stop offset="100%" stopColor="#d8bd80" />
      </radialGradient>
      <linearGradient id="pawn" x1="0" x2="1">
        <stop offset="0%" stopColor="#f2f3f4" />
        <stop offset="55%" stopColor="#b9bec3" />
        <stop offset="100%" stopColor="#7c8389" />
      </linearGradient>
      <linearGradient id="plank" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c08a4d" />
        <stop offset="100%" stopColor="#7a4e26" />
      </linearGradient>
      <linearGradient id="flag" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff8e2" />
        <stop offset="100%" stopColor="#ead7a8" />
      </linearGradient>
    </defs>
  );
}

/** Wooden settlement: front face, side face, two roof planes and a cast shadow. */
function Settlement({ x, y, color }: { x: number; y: number; color: string }) {
  const side = shade(color);
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <ellipse cx={5} cy={11} rx={14} ry={5} fill="rgba(20,12,4,0.38)" />
      <g className="piece-drop">
        <polygon points="-9,10 -9,0 4,0 4,10" fill={color} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="4,10 4,0 11,-4 11,6" fill={side} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="-11,1 -2.5,-10 6,1" fill={color} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="-2.5,-10 4.5,-14 12,-3 6,1" fill={side} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <line x1="-8" y1="-0.5" x2="-3" y2="-7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function City({ x, y, color }: { x: number; y: number; color: string }) {
  const side = shade(color);
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <ellipse cx={6} cy={12} rx={19} ry={6} fill="rgba(20,12,4,0.38)" />
      <g className="piece-drop">
        {/* Hall */}
        <polygon points="-15,11 -15,1 5,1 5,11" fill={color} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="5,11 5,1 13,-3 13,7" fill={side} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        {/* Tower with roof */}
        <polygon points="-15,1 -15,-9 -3,-9 -3,1" fill={color} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="-3,1 -3,-9 5,-13 5,-3" fill={side} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="-16.5,-8 -9,-18 -1.5,-8" fill={color} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points="-9,-18 -2,-22 6.5,-12 -1.5,-8" fill={side} stroke="#1d150d" strokeWidth="1.3" strokeLinejoin="round" />
        <line x1="-14" y1="-8.5" x2="-10" y2="-15" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" />
        <rect x={-10} y={4} width={4} height={7} fill="rgba(0,0,0,0.3)" />
      </g>
    </g>
  );
}

/** Pan & pinch-zoom container. Taps after a drag are suppressed. */
function PanZoom({ children, svgRef }: { children: ReactNode; svgRef?: React.MutableRefObject<SVGSVGElement | null> }) {
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; k: number; moved: number } | null>(null);
  const localRef = useRef<SVGSVGElement | null>(null);
  const dragged = useRef(false);

  const clampK = (k: number) => Math.min(3, Math.max(0.85, k));
  const toSvgScale = () => {
    const rect = localRef.current?.getBoundingClientRect();
    return rect ? Math.max(VIEW / rect.width, VIEW / rect.height) : 1;
  };

  const onPointerDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: t.k, moved: 0 };
    } else {
      gesture.current = { dist: 0, k: t.k, moved: 0 };
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved > 8) dragged.current = true;
    const scale = toSvgScale();
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      // Read the gesture now: the state update runs later, when the fingers may already be up.
      const { k, dist: startDist } = gesture.current;
      if (startDist > 0) setT((cur) => ({ ...cur, k: clampK((k * dist) / startDist) }));
    } else if (dragged.current) {
      setT((cur) => ({ ...cur, x: cur.x + dx * scale, y: cur.y + dy * scale }));
    }
  };

  const onPointerUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  };

  const onWheel = (e: WheelEvent) => {
    setT((cur) => ({ ...cur, k: clampK(cur.k * (e.deltaY < 0 ? 1.1 : 0.9)) }));
  };

  return (
    <svg
      ref={(el) => {
        localRef.current = el;
        if (svgRef) svgRef.current = el;
      }}
      className="board-svg"
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onClickCapture={(e) => {
        if (dragged.current) {
          e.stopPropagation();
          dragged.current = false;
        }
      }}
      onDoubleClick={() => setT({ x: 0, y: 0, k: 1 })}
    >
      <Defs />
      <g className="board-root" transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
        {children}
      </g>
    </svg>
  );
}

export function Board({ view, targets, selection, onSelect, highlightHexes, onInspectHex, apiRef }: BoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      project(x, y) {
        const root = svgRef.current?.querySelector('.board-root') as SVGGElement | null;
        const m = root?.getScreenCTM();
        if (!m) return null;
        const p = new DOMPoint(x, y).matrixTransform(m);
        return { x: p.x, y: p.y };
      },
    };
  }, [apiRef]);
  const colors = view.players.map((p) => p.color);
  const vSet = useMemo(() => new Set(targets.vertices ?? []), [targets.vertices]);
  const eSet = useMemo(() => new Set(targets.edges ?? []), [targets.edges]);
  const hSet = useMemo(() => new Set(targets.hexes ?? []), [targets.hexes]);
  const myColor = colors[view.me ?? 0];
  const robber = GRAPH.hexes[view.board.robberHex];

  return (
    <PanZoom svgRef={svgRef}>
      {/* Sea frame and beach (pre-painted) */}
      <image href="/art/sea.webp" x={-VIEW / 2} y={-VIEW / 2} width={VIEW} height={VIEW} preserveAspectRatio="none" />

      {/* Harbors: wooden pier and a parchment flag */}
      {view.board.harbors.map((h) => {
        const e = GRAPH.edges[h.edge];
        const hex = GRAPH.hexes[e.hexes[0]];
        const dx = e.x - hex.x;
        const dy = e.y - hex.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const px = (e.x + ux * 0.62) * S;
        const py = (e.y + uy * 0.62) * S;
        const [a, b] = e.vertices.map((v) => GRAPH.vertices[v]);
        return (
          <g key={h.edge} className="harbor" pointerEvents="none">
            {[a, b].map((v, i) => {
              const sx = v.x * S;
              const sy = v.y * S;
              const ang = (Math.atan2(py - sy, px - sx) * 180) / Math.PI;
              const l = Math.hypot(px - sx, py - sy);
              return (
                <g key={i} transform={`translate(${sx},${sy}) rotate(${ang})`}>
                  <rect x={2} y={-1} width={l - 6} height={8} fill="rgba(10,40,60,0.35)" />
                  <rect x={0} y={-4} width={l - 6} height={8} rx={1.5} fill="url(#plank)" stroke="#4a2c12" strokeWidth="1" />
                  {Array.from({ length: Math.floor(l / 7) }, (_, k) => (
                    <line key={k} x1={4 + k * 7} y1={-4} x2={4 + k * 7} y2={4} stroke="#5b3a1a" strokeWidth="0.8" />
                  ))}
                </g>
              );
            })}
            <g transform={`translate(${px},${py})`}>
              <ellipse cx={3} cy={17} rx={16} ry={4} fill="rgba(10,40,60,0.35)" />
              <line x1={0} y1={16} x2={0} y2={-18} stroke="#4a2c12" strokeWidth="2.4" />
              <path d="M1,-18 L24,-14 L20,-6 L24,2 L1,2 Z" fill="url(#flag)" stroke="#7a5a2a" strokeWidth="1.2" />
              {h.type === 'generic' ? (
                <text x={12} y={-4} className="harbor-big">?</text>
              ) : (
                <ResourceGlyph r={h.type} size={15} x={4.5} y={-16} />
              )}
              <rect x={-14} y={4} width={28} height={13} rx={3} fill="#3b2412" />
              <text x={0} y={14} className="harbor-rate">
                {h.type === 'generic' ? '3:1' : '2:1'}
              </text>
            </g>
          </g>
        );
      })}

      {/* Land tiles */}
      {view.board.hexes.map((tile) => {
        const g = GRAPH.hexes[tile.id];
        const cx = g.x * S;
        const cy = g.y * S;
        const targetable = hSet.has(tile.id);
        const selected = selection?.kind === 'hex' && selection.id === tile.id;
        return (
          <g
            key={tile.id}
            className={`hex ${targetable ? 'targetable' : ''} ${highlightHexes.includes(tile.id) ? 'producing' : ''}`}
            onClick={() => (targetable ? onSelect({ kind: 'hex', id: tile.id }) : onInspectHex?.(tile.id))}
          >
            <image
              className="hex-tile"
              href={`/art/hex-${tile.terrain}-${tile.id % 2}.webp`}
              x={cx - TILE_W / 2}
              y={cy - TILE_H / 2}
              width={TILE_W}
              height={TILE_H}
            />
            {highlightHexes.includes(tile.id) && <polygon points={hexPoints(cx, cy, TILE_R)} className="hex-glow" />}
            {(targetable || selected) && <polygon points={hexPoints(cx, cy, S - 6)} className={`hex-target ${selected ? 'selected' : ''}`} />}
          </g>
        );
      })}

      {/* Number discs */}
      {view.board.hexes.map((tile) => {
        if (tile.number === null) return null;
        const g = GRAPH.hexes[tile.id];
        const cx = g.x * S;
        const cy = g.y * S;
        const red = tile.number === 6 || tile.number === 8;
        return (
          <g key={`n${tile.id}`} pointerEvents="none">
            <ellipse cx={cx + 2.5} cy={cy + 4} rx={18.5} ry={17} fill="rgba(25,15,5,0.4)" />
            <circle cx={cx} cy={cy} r={18} fill="url(#disc)" stroke="#9d7e45" strokeWidth="1.2" />
            <circle cx={cx} cy={cy} r={15.2} fill="none" stroke="rgba(157,126,69,0.45)" strokeWidth="0.8" />
            <text x={cx} y={cy + 5} className={`token-num ${red ? 'red' : ''}`}>
              {tile.number}
            </text>
            {Array.from({ length: PIPS[tile.number] }, (_, i) => (
              <circle key={i} cx={cx + (i - (PIPS[tile.number!] - 1) / 2) * 4.2} cy={cy + 10.5} r={1.45} fill={red ? '#b3261a' : '#3a2f22'} />
            ))}
          </g>
        );
      })}

      {/* Roads: wooden bars with a cast shadow */}
      {Object.entries(view.roads).map(([edge, owner]) => {
        const [a, b] = GRAPH.edges[edge].vertices.map((v) => GRAPH.vertices[v]);
        const sx = (a.x + (b.x - a.x) * 0.17) * S;
        const sy = (a.y + (b.y - a.y) * 0.17) * S;
        const ex = (a.x + (b.x - a.x) * 0.83) * S;
        const ey = (a.y + (b.y - a.y) * 0.83) * S;
        // Highlight on the side facing the light (up-left), whatever the road's angle.
        const len = Math.hypot(ex - sx, ey - sy);
        let nx = -(ey - sy) / len;
        let ny = (ex - sx) / len;
        if (ny + nx * 0.5 > 0) {
          nx = -nx;
          ny = -ny;
        }
        return (
          <g key={edge} pointerEvents="none">
            <line x1={sx + 2.5} y1={sy + 3.5} x2={ex + 2.5} y2={ey + 3.5} stroke="rgba(20,12,4,0.35)" strokeWidth={9} strokeLinecap="round" />
            <g className="piece-drop">
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#1d150d" strokeWidth={10} strokeLinecap="butt" />
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={shade(colors[owner])} strokeWidth={7.6} strokeLinecap="butt" />
              <line x1={sx + nx * 1.4} y1={sy + ny * 1.4} x2={ex + nx * 1.4} y2={ey + ny * 1.4} stroke={colors[owner]} strokeWidth={4} strokeLinecap="butt" />
              <line x1={sx + nx * 2.6} y1={sy + ny * 2.6} x2={ex + nx * 2.6} y2={ey + ny * 2.6} stroke="rgba(255,255,255,0.4)" strokeWidth={1.1} strokeLinecap="butt" />
            </g>
          </g>
        );
      })}

      {/* Edge targets */}
      {[...eSet].map((edge) => {
        const [a, b] = GRAPH.edges[edge].vertices.map((v) => GRAPH.vertices[v]);
        const selected = selection?.kind === 'edge' && selection.id === edge;
        return (
          <g key={edge} onClick={() => onSelect({ kind: 'edge', id: edge })} className="target">
            <line x1={a.x * S} y1={a.y * S} x2={b.x * S} y2={b.y * S} className="edge-hit" />
            <line
              x1={(a.x + (b.x - a.x) * 0.2) * S}
              y1={(a.y + (b.y - a.y) * 0.2) * S}
              x2={(a.x + (b.x - a.x) * 0.8) * S}
              y2={(a.y + (b.y - a.y) * 0.8) * S}
              className={`edge-target ${selected ? 'selected' : ''}`}
              stroke={selected ? myColor : undefined}
            />
          </g>
        );
      })}

      {/* Buildings */}
      {Object.entries(view.buildings).map(([vertex, b]) => {
        const v = GRAPH.vertices[vertex];
        return b.type === 'city' ? (
          <City key={`${vertex}-c`} x={v.x * S} y={v.y * S} color={colors[b.owner]} />
        ) : (
          <Settlement key={`${vertex}-s`} x={v.x * S} y={v.y * S} color={colors[b.owner]} />
        );
      })}

      {/* Robber: grey pawn that slides between lands */}
      <g className="robber" style={{ transform: `translate(${robber.x * S + 22}px, ${robber.y * S - 14}px)` }} pointerEvents="none">
        <ellipse cx={4} cy={19} rx={13} ry={4.5} fill="rgba(20,12,4,0.42)" />
        <path d="M-10,18 Q-12,4 -6,-1 Q-11,-9 -4,-14 L4,-14 Q11,-9 6,-1 Q12,4 10,18 Z" fill="url(#pawn)" stroke="#50565c" strokeWidth="1.3" />
        <circle cx={0} cy={-17} r={6.5} fill="url(#pawn)" stroke="#50565c" strokeWidth="1.3" />
        <ellipse cx={-2.5} cy={-19} rx={2} ry={1.4} fill="rgba(255,255,255,0.7)" />
      </g>

      {/* Vertex targets */}
      {[...vSet].map((vertex) => {
        const v = GRAPH.vertices[vertex];
        const selected = selection?.kind === 'vertex' && selection.id === vertex;
        return (
          <g key={vertex} onClick={() => onSelect({ kind: 'vertex', id: vertex })} className="target">
            <circle cx={v.x * S} cy={v.y * S} r={20} fill="transparent" />
            <circle
              cx={v.x * S}
              cy={v.y * S}
              r={selected ? 11 : 8}
              className={`vertex-target ${selected ? 'selected' : ''}`}
              fill={selected ? myColor : undefined}
            />
          </g>
        );
      })}
    </PanZoom>
  );
}

/** Centre of a hex in board units (for animations). */
export function hexCenter(hex: number): { x: number; y: number } {
  const g = GRAPH.hexes[hex];
  return { x: g.x * S, y: g.y * S };
}
