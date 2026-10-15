import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent } from 'react';
import { GRAPH, type PlayerView, type Terrain } from '@hex/engine';
import { RESOURCE_COLOR, RESOURCE_ICON } from '../strings';

const S = 60; // pixels per hex radius in SVG space

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

interface Props {
  view: PlayerView;
  targets: BoardTargets;
  selection: Selection;
  onSelect: (s: Selection) => void;
  highlightHexes: number[];
  onInspectHex?: (hex: number) => void;
}

const TERRAIN_FILL: Record<Terrain, [string, string]> = {
  forest: ['#3f9b4b', '#256b33'],
  hills: ['#d9774a', '#a94a26'],
  pasture: ['#a8db6c', '#6fae3e'],
  fields: ['#f3d36b', '#d9a92e'],
  mountains: ['#a3acb8', '#6b7480'],
  desert: ['#f1deaa', '#d8bd7c'],
};

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

function TerrainArt({ terrain, x, y }: { terrain: Terrain; x: number; y: number }) {
  switch (terrain) {
    case 'forest':
      return (
        <g fill="#1d5a2a" opacity={0.85}>
          {[[-22, 8], [20, 10], [-4, -26], [24, -18], [-26, -16]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${x + dx},${y + dy})`}>
              <polygon points="0,-12 9,6 -9,6" />
              <rect x={-2} y={6} width={4} height={5} fill="#5b3a1e" />
            </g>
          ))}
        </g>
      );
    case 'hills':
      return (
        <g fill="none" stroke="#8a3a1b" strokeWidth={3} opacity={0.6}>
          <path d={`M${x - 34},${y + 14} q17,-22 34,0 q17,-22 34,0`} />
          <path d={`M${x - 22},${y - 14} q12,-16 24,0 q12,-16 24,0`} />
        </g>
      );
    case 'pasture':
      return (
        <g>
          {[[-20, -14], [18, -20], [-6, 18], [24, 12]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${x + dx},${y + dy})`}>
              <ellipse rx={7} ry={5} fill="#fff" />
              <circle cx={6} cy={-2} r={2.5} fill="#333" />
            </g>
          ))}
        </g>
      );
    case 'fields':
      return (
        <g stroke="#b5841c" strokeWidth={2.5} opacity={0.7}>
          {[-24, -12, 0, 12, 24].map((dx) => (
            <line key={dx} x1={x + dx} y1={y - 26} x2={x + dx - 8} y2={y + 26} />
          ))}
        </g>
      );
    case 'mountains':
      return (
        <g>
          <polygon points={`${x - 34},${y + 18} ${x - 10},${y - 24} ${x + 12},${y + 18}`} fill="#5c6570" />
          <polygon points={`${x - 6},${y + 18} ${x + 16},${y - 14} ${x + 36},${y + 18}`} fill="#4a525c" />
          <polygon points={`${x - 16},${y - 13} ${x - 10},${y - 24} ${x - 4},${y - 13}`} fill="#fff" />
        </g>
      );
    case 'desert':
      return (
        <g fill="none" stroke="#c9a663" strokeWidth={2.5}>
          <path d={`M${x - 30},${y + 10} q15,-10 30,0 t30,0`} />
          <path d={`M${x - 20},${y - 14} q10,-8 20,0 t20,0`} />
        </g>
      );
  }
}

const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

function House({ x, y, color, city }: { x: number; y: number; color: string; city: boolean }) {
  const path = city
    ? 'M-15,10 L-15,-6 L-6,-6 L-6,-14 L2,-20 L10,-14 L10,-6 L15,-6 L15,10 Z'
    : 'M-10,9 L-10,-3 L0,-12 L10,-3 L10,9 Z';
  return (
    <g transform={`translate(${x},${y})`} className="piece-pop">
      <path d={path} fill={color} stroke="#1b1b1b" strokeWidth={2.2} strokeLinejoin="round" />
      {city && <rect x={-3} y={0} width={6} height={10} fill="rgba(0,0,0,0.25)" />}
    </g>
  );
}

/** Pan & pinch-zoom container. Taps after a drag are suppressed. */
function PanZoom({ children, width, height }: { children: ReactNode; width: number; height: number }) {
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; k: number; moved: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragged = useRef(false);

  const clampK = (k: number) => Math.min(3, Math.max(0.8, k));
  const toSvgScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? width / rect.width : 1;
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
      if (gesture.current.dist > 0) setT((cur) => ({ ...cur, k: clampK((gesture.current!.k * dist) / gesture.current!.dist) }));
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
      ref={svgRef}
      className="board-svg"
      viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
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
      <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>{children}</g>
    </svg>
  );
}

export function Board({ view, targets, selection, onSelect, highlightHexes, onInspectHex }: Props) {
  const colors = view.players.map((p) => p.color);
  const vSet = useMemo(() => new Set(targets.vertices ?? []), [targets.vertices]);
  const eSet = useMemo(() => new Set(targets.edges ?? []), [targets.edges]);
  const hSet = useMemo(() => new Set(targets.hexes ?? []), [targets.hexes]);
  const width = 11 * S;
  const height = 11 * S;

  return (
    <PanZoom width={width} height={height}>
      {/* Ocean */}
      <polygon points={hexPoints(0, 0, 5.6 * S)} className="ocean" transform="rotate(30)" />
      <polygon points={hexPoints(0, 0, 4.95 * S)} className="shore" transform="rotate(30)" />

      {/* Harbors */}
      {view.board.harbors.map((h) => {
        const e = GRAPH.edges[h.edge];
        const hex = GRAPH.hexes[e.hexes[0]];
        const dx = e.x - hex.x;
        const dy = e.y - hex.y;
        const len = Math.hypot(dx, dy);
        const px = (e.x + (dx / len) * 0.62) * S;
        const py = (e.y + (dy / len) * 0.62) * S;
        const [a, b] = e.vertices.map((v) => GRAPH.vertices[v]);
        const color = h.type === 'generic' ? '#ffffff' : RESOURCE_COLOR[h.type];
        return (
          <g key={h.edge} className="harbor">
            <line x1={a.x * S} y1={a.y * S} x2={px} y2={py} />
            <line x1={b.x * S} y1={b.y * S} x2={px} y2={py} />
            <circle cx={px} cy={py} r={17} fill={color} stroke="#4b3621" strokeWidth={3} />
            <text x={px} y={py + (h.type === 'generic' ? 5 : -1)} className="harbor-text">
              {h.type === 'generic' ? '3:1' : RESOURCE_ICON[h.type]}
            </text>
            {h.type !== 'generic' && (
              <text x={px} y={py + 12} className="harbor-rate">2:1</text>
            )}
          </g>
        );
      })}

      {/* Hexes */}
      {view.board.hexes.map((tile) => {
        const g = GRAPH.hexes[tile.id];
        const cx = g.x * S;
        const cy = g.y * S;
        const [c1, c2] = TERRAIN_FILL[tile.terrain];
        const targetable = hSet.has(tile.id);
        const selected = selection?.kind === 'hex' && selection.id === tile.id;
        return (
          <g
            key={tile.id}
            className={`hex ${targetable ? 'targetable' : ''} ${highlightHexes.includes(tile.id) ? 'producing' : ''}`}
            onClick={() => (targetable ? onSelect({ kind: 'hex', id: tile.id }) : onInspectHex?.(tile.id))}
          >
            <defs>
              <radialGradient id={`g${tile.id}`} cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </radialGradient>
            </defs>
            <polygon points={hexPoints(cx, cy, S - 1.5)} fill={`url(#g${tile.id})`} stroke="#f6e7bf" strokeWidth={3} />
            <TerrainArt terrain={tile.terrain} x={cx} y={cy} />
            {tile.number !== null && (
              <g>
                <circle cx={cx} cy={cy} r={18} className="token" />
                <text x={cx} y={cy + 6} className={`token-num ${tile.number === 6 || tile.number === 8 ? 'red' : ''}`}>
                  {tile.number}
                </text>
                <g>
                  {Array.from({ length: PIPS[tile.number] }, (_, i) => (
                    <circle
                      key={i}
                      cx={cx + (i - (PIPS[tile.number!] - 1) / 2) * 4.5}
                      cy={cy + 12}
                      r={1.6}
                      fill={tile.number === 6 || tile.number === 8 ? '#c62828' : '#333'}
                    />
                  ))}
                </g>
              </g>
            )}
            {(targetable || selected) && (
              <polygon points={hexPoints(cx, cy, S - 6)} className={`hex-target ${selected ? 'selected' : ''}`} />
            )}
          </g>
        );
      })}

      {/* Robber */}
      {(() => {
        const g = GRAPH.hexes[view.board.robberHex];
        const x = g.x * S + 22;
        const y = g.y * S - 18;
        return (
          <g className="robber" transform={`translate(${x},${y})`} pointerEvents="none">
            <ellipse cx={0} cy={16} rx={11} ry={4} fill="rgba(0,0,0,0.35)" />
            <path d="M-9,15 Q-11,0 -5,-4 Q-9,-10 0,-16 Q9,-10 5,-4 Q11,0 9,15 Z" fill="#2b2b33" stroke="#000" strokeWidth={1.5} />
            <circle cx={0} cy={-12} r={5} fill="#3d3d47" />
          </g>
        );
      })()}

      {/* Roads */}
      {Object.entries(view.roads).map(([edge, owner]) => {
        const [a, b] = GRAPH.edges[edge].vertices.map((v) => GRAPH.vertices[v]);
        const sx = a.x + (b.x - a.x) * 0.15;
        const sy = a.y + (b.y - a.y) * 0.15;
        const ex = a.x + (b.x - a.x) * 0.85;
        const ey = a.y + (b.y - a.y) * 0.85;
        return (
          <g key={edge} className="piece-pop">
            <line x1={sx * S} y1={sy * S} x2={ex * S} y2={ey * S} stroke="#1b1b1b" strokeWidth={11} strokeLinecap="round" />
            <line x1={sx * S} y1={sy * S} x2={ex * S} y2={ey * S} stroke={colors[owner]} strokeWidth={7} strokeLinecap="round" />
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
              stroke={selected ? colors[view.me ?? 0] : undefined}
            />
          </g>
        );
      })}

      {/* Buildings */}
      {Object.entries(view.buildings).map(([vertex, b]) => {
        const v = GRAPH.vertices[vertex];
        return <House key={vertex} x={v.x * S} y={v.y * S} color={colors[b.owner]} city={b.type === 'city'} />;
      })}

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
              fill={selected ? colors[view.me ?? 0] : undefined}
            />
          </g>
        );
      })}
    </PanZoom>
  );
}
