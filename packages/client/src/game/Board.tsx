import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent } from 'react';
import { GRAPH, type PlayerView, type Terrain } from '@hex/engine';
import { ResourceGlyph, shade } from '../art';

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
  forest: ['#3f8a3a', '#1f5524'],
  hills: ['#d7804b', '#a24a22'],
  pasture: ['#a9d86a', '#6ea83c'],
  fields: ['#f2cf62', '#cf9a26'],
  mountains: ['#9ea6b0', '#5e6670'],
  desert: ['#f0dca6', '#d5b874'],
};

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

/** Texture patterns that give each terrain a painted feel. */
function TerrainPatterns() {
  return (
    <defs>
      <pattern id="pat-forest" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
        <circle cx="5" cy="6" r="5" fill="#2d6e2c" />
        <circle cx="16" cy="15" r="6" fill="#255e25" />
        <circle cx="16" cy="3" r="3.5" fill="#3a7d34" />
        <circle cx="4" cy="18" r="3" fill="#3a7d34" />
      </pattern>
      <pattern id="pat-hills" width="26" height="18" patternUnits="userSpaceOnUse">
        <path d="M0 14 Q6 4 13 14 Q19 4 26 14" fill="none" stroke="#9c4420" strokeWidth="2" opacity="0.55" />
        <circle cx="20" cy="5" r="1.6" fill="#f0b07f" opacity="0.6" />
      </pattern>
      <pattern id="pat-pasture" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M3 12 l1.5 -4 l1.5 4 M10 6 l1.5 -4 l1.5 4" stroke="#5f9a33" strokeWidth="1.2" fill="none" />
      </pattern>
      <pattern id="pat-fields" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <rect width="10" height="5" fill="#e9bd40" />
        <rect y="5" width="10" height="5" fill="#d9a52c" />
      </pattern>
      <pattern id="pat-mountains" width="24" height="20" patternUnits="userSpaceOnUse">
        <polygon points="0,20 7,8 14,20" fill="#7d858f" />
        <polygon points="12,20 19,6 26,20" fill="#6a727c" />
        <polygon points="5,11.5 7,8 9,11.5" fill="#e6eaee" />
      </pattern>
      <pattern id="pat-desert" width="30" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 10 Q7.5 4 15 10 T30 10" fill="none" stroke="#c9a85e" strokeWidth="1.6" />
      </pattern>
      <radialGradient id="sea" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#2fb3cf" />
        <stop offset="100%" stopColor="#0f6f93" />
      </radialGradient>
      <radialGradient id="disc" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#fbf0cf" />
        <stop offset="100%" stopColor="#e8d09a" />
      </radialGradient>
      <linearGradient id="robber" x1="0" x2="1">
        <stop offset="0%" stopColor="#eef0f2" />
        <stop offset="100%" stopColor="#8d949b" />
      </linearGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

function TerrainArt({ terrain, x, y }: { terrain: Terrain; x: number; y: number }) {
  switch (terrain) {
    case 'forest':
      return (
        <g>
          {[[-24, 12], [22, 14], [-6, -28], [26, -14], [-28, -14], [6, 26]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${x + dx},${y + dy})`}>
              <polygon points="0,-14 10,4 -10,4" fill="#1d5422" stroke="#123815" strokeWidth="1" />
              <polygon points="0,-8 8,8 -8,8" fill="#2a6a2a" stroke="#123815" strokeWidth="1" />
              <rect x={-1.6} y={8} width={3.2} height={4} fill="#5b3a1e" />
            </g>
          ))}
        </g>
      );
    case 'hills':
      return (
        <g transform={`translate(${x - 30},${y + 14})`} stroke="#6b2a10" strokeWidth="1">
          <rect x="0" y="0" width="12" height="6" fill="#c8562a" />
          <rect x="13" y="0" width="12" height="6" fill="#b84b22" />
          <rect x="6" y="-7" width="12" height="6" fill="#d4643a" />
          <rect x="40" y="-30" width="12" height="6" fill="#c8562a" />
          <rect x="47" y="-37" width="12" height="6" fill="#d4643a" />
        </g>
      );
    case 'pasture':
      return (
        <g>
          {[[-22, -12], [18, -20], [-4, 18], [26, 12]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${x + dx},${y + dy})`} filter="url(#soft)">
              <ellipse rx={8} ry={5.5} fill="#fbfbf5" stroke="#9a9a90" strokeWidth="0.8" />
              <ellipse cx={7} cy={-2} rx={2.8} ry={2.3} fill="#333" />
            </g>
          ))}
          <path d={`M${x - 36},${y + 30} l20,-6 m6,-2 l20,-6`} stroke="#8a5a2b" strokeWidth="2" />
        </g>
      );
    case 'fields':
      return (
        <g>
          {[[-22, -16], [20, 18], [24, -18]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${x + dx},${y + dy})`} stroke="#8a6512" strokeWidth="1">
              <ellipse cx="0" cy="0" rx="5" ry="8" fill="#f5d36a" />
              <line x1="0" y1="-8" x2="0" y2="10" />
            </g>
          ))}
        </g>
      );
    case 'mountains':
      return (
        <g filter="url(#soft)">
          <polygon points={`${x - 38},${y + 22} ${x - 12},${y - 26} ${x + 12},${y + 22}`} fill="#5c6570" stroke="#3b4148" strokeWidth="1.2" />
          <polygon points={`${x - 6},${y + 22} ${x + 18},${y - 16} ${x + 40},${y + 22}`} fill="#4a525c" stroke="#3b4148" strokeWidth="1.2" />
          <polygon points={`${x - 19},${y - 13} ${x - 12},${y - 26} ${x - 5},${y - 13}`} fill="#fff" />
          <polygon points={`${x + 12},${y - 6} ${x + 18},${y - 16} ${x + 24},${y - 6}`} fill="#fff" />
        </g>
      );
    case 'desert':
      return (
        <g>
          <path d={`M${x - 20},${y + 26} q4,-14 0,-22 q8,4 6,22 z`} fill="#4f8a3a" />
          <path d={`M${x + 18},${y - 22} q10,-6 20,0`} fill="none" stroke="#b38f45" strokeWidth="2" />
        </g>
      );
  }
}

const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

function Settlement({ x, y, color }: { x: number; y: number; color: string }) {
  const side = shade(color);
  return (
    <g transform={`translate(${x},${y})`} className="piece-pop" filter="url(#soft)">
      <polygon points="-9,10 -9,-1 0,-10 4,-6 4,10" fill={color} stroke="#1b1b1b" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="4,10 4,-6 0,-10 7,-8 12,-1 12,8" fill={side} stroke="#1b1b1b" strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  );
}

function City({ x, y, color }: { x: number; y: number; color: string }) {
  const side = shade(color);
  return (
    <g transform={`translate(${x},${y})`} className="piece-pop" filter="url(#soft)">
      <polygon points="-14,11 -14,-2 -4,-2 -4,-10 3,-17 10,-10 10,11" fill={color} stroke="#1b1b1b" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="10,11 10,-10 3,-17 9,-15 16,-8 16,9" fill={side} stroke="#1b1b1b" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x={-11} y={3} width={4} height={8} fill="rgba(0,0,0,0.25)" />
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
    return rect ? Math.max(width / rect.width, height / rect.height) : 1;
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
      <TerrainPatterns />
      <rect x={-width} y={-height} width={width * 2} height={height * 2} fill="url(#sea)" />
      <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>{children}</g>
    </svg>
  );
}

export function Board({ view, targets, selection, onSelect, highlightHexes, onInspectHex }: Props) {
  const colors = view.players.map((p) => p.color);
  const vSet = useMemo(() => new Set(targets.vertices ?? []), [targets.vertices]);
  const eSet = useMemo(() => new Set(targets.edges ?? []), [targets.edges]);
  const hSet = useMemo(() => new Set(targets.hexes ?? []), [targets.hexes]);
  const width = 10.6 * S;
  const height = 10.6 * S;
  const myColor = colors[view.me ?? 0];

  return (
    <PanZoom width={width} height={height}>
      {/* Shallow water and beach: enlarged copies of every land hex form the island's coast. */}
      <g>
        {GRAPH.hexes.map((h) => (
          <polygon key={`sh${h.id}`} points={hexPoints(h.x * S, h.y * S, S * 1.42)} fill="#57c8dc" opacity="0.55" />
        ))}
        {GRAPH.hexes.map((h) => (
          <polygon key={`be${h.id}`} points={hexPoints(h.x * S, h.y * S, S * 1.16)} fill="#ecd59a" />
        ))}
      </g>

      {/* Harbors: wooden piers and a parchment tag. */}
      {view.board.harbors.map((h) => {
        const e = GRAPH.edges[h.edge];
        const hex = GRAPH.hexes[e.hexes[0]];
        const dx = e.x - hex.x;
        const dy = e.y - hex.y;
        const len = Math.hypot(dx, dy);
        const px = (e.x + (dx / len) * 0.7) * S;
        const py = (e.y + (dy / len) * 0.7) * S;
        const [a, b] = e.vertices.map((v) => GRAPH.vertices[v]);
        return (
          <g key={h.edge} className="harbor">
            {[a, b].map((v, i) => (
              <g key={i}>
                <line x1={v.x * S} y1={v.y * S} x2={px} y2={py} stroke="#4a2e12" strokeWidth="8" strokeLinecap="round" />
                <line x1={v.x * S} y1={v.y * S} x2={px} y2={py} stroke="#a8743d" strokeWidth="5" strokeLinecap="round" strokeDasharray="5 2" />
              </g>
            ))}
            <g transform={`translate(${px},${py})`} filter="url(#soft)">
              <rect x={-19} y={-15} width={38} height={30} rx={5} fill="#f7ecd0" stroke="#7a5a2a" strokeWidth="2" />
              {h.type === 'generic' ? (
                <>
                  <text y={2} className="harbor-big">?</text>
                  <text y={12} className="harbor-rate">3:1</text>
                </>
              ) : (
                <>
                  <ResourceGlyph r={h.type} size={20} x={-10} y={-15} />
                  <text y={12} className="harbor-rate">2:1</text>
                </>
              )}
            </g>
          </g>
        );
      })}

      {/* Land */}
      {view.board.hexes.map((tile) => {
        const g = GRAPH.hexes[tile.id];
        const cx = g.x * S;
        const cy = g.y * S;
        const [c1, c2] = TERRAIN_FILL[tile.terrain];
        const targetable = hSet.has(tile.id);
        const selected = selection?.kind === 'hex' && selection.id === tile.id;
        const red = tile.number === 6 || tile.number === 8;
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
            <polygon className="hex-base" points={hexPoints(cx, cy, S)} fill={`url(#g${tile.id})`} />
            <polygon points={hexPoints(cx, cy, S)} fill={`url(#pat-${tile.terrain})`} opacity="0.55" />
            <TerrainArt terrain={tile.terrain} x={cx} y={cy} />
            <polygon points={hexPoints(cx, cy, S)} fill="none" stroke="#ead6a0" strokeWidth="5" />
            {tile.number !== null && (
              <g filter="url(#soft)">
                <circle cx={cx} cy={cy} r={19} fill="url(#disc)" stroke="#bd9f62" strokeWidth="1.5" />
                <text x={cx} y={cy + 5} className={`token-num ${red ? 'red' : ''}`}>
                  {tile.number}
                </text>
                {Array.from({ length: PIPS[tile.number] }, (_, i) => (
                  <circle
                    key={i}
                    cx={cx + (i - (PIPS[tile.number!] - 1) / 2) * 4.4}
                    cy={cy + 11.5}
                    r={1.5}
                    fill={red ? '#c0281c' : '#3a2f22'}
                  />
                ))}
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
        const x = g.x * S + 24;
        const y = g.y * S - 16;
        return (
          <g className="robber" transform={`translate(${x},${y})`} pointerEvents="none">
            <ellipse cx={0} cy={18} rx={12} ry={4} fill="rgba(0,0,0,0.35)" />
            <path d="M-10,17 Q-12,2 -5,-3 Q-10,-11 0,-18 Q10,-11 5,-3 Q12,2 10,17 Z" fill="url(#robber)" stroke="#4b5056" strokeWidth="1.6" />
            <circle cx={0} cy={-14} r={5.5} fill="url(#robber)" stroke="#4b5056" strokeWidth="1.4" />
          </g>
        );
      })()}

      {/* Roads: wooden bars */}
      {Object.entries(view.roads).map(([edge, owner]) => {
        const [a, b] = GRAPH.edges[edge].vertices.map((v) => GRAPH.vertices[v]);
        const sx = (a.x + (b.x - a.x) * 0.16) * S;
        const sy = (a.y + (b.y - a.y) * 0.16) * S;
        const ex = (a.x + (b.x - a.x) * 0.84) * S;
        const ey = (a.y + (b.y - a.y) * 0.84) * S;
        return (
          <g key={edge} className="piece-pop" filter="url(#soft)">
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#1b1b1b" strokeWidth={11} strokeLinecap="square" />
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={shade(colors[owner])} strokeWidth={8} strokeLinecap="square" />
            <line x1={sx} y1={sy - 1.5} x2={ex} y2={ey - 1.5} stroke={colors[owner]} strokeWidth={4.5} strokeLinecap="square" />
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
          <City key={vertex} x={v.x * S} y={v.y * S} color={colors[b.owner]} />
        ) : (
          <Settlement key={vertex} x={v.x * S} y={v.y * S} color={colors[b.owner]} />
        );
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
              fill={selected ? myColor : undefined}
            />
          </g>
        );
      })}
    </PanZoom>
  );
}
