'use client';

interface StageStats {
  count: number;
  avgHours: number;
}

interface FlowGraphProps {
  stats: Record<string, StageStats>;
}

interface Node {
  id: string;
  emoji: string;
  label: string;
  agent: string;
  trigger: string;
  x: number;
  y: number;
  statuses: string[];
  color: string;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

// Layout: Human mental model of content production
//
//   INTEL GATHERING              THE BRAIN        PRODUCTION              OUTPUT
//   ┌──────┐  ┌──────┐           ┌──────┐
//   │ Oti  │──│ Mači │──────────→│ Liso │→ Pino → Rada → Zala → Lana → Published
//   └──────┘  └──────┘    ┌─────→│      │                         │        │
//                         │      └──────┘                    Approve        │
//   ┌──────┐              │                                           Bea  Kroki
//   │ Vuk  │──────────────┘
//   └──────┘
//
//   INFRASTRUCTURE: Router orchestrates pipeline, Medo watches Router

const NODES: Node[] = [
  // === FEEDBACK LOOP + INFRASTRUCTURE (top row) ===
  { id: 'vuk',    emoji: '🐺',    label: 'Strategy',  agent: 'Vuk',   trigger: '⏰ Sun 20:00',    x: 250, y: 25,  statuses: [], color: '#64748b' },
  { id: 'kroki',  emoji: '🐦‍⬛', label: 'Analytics', agent: 'Kroki', trigger: '⏰ Mon 08:00',    x: 480, y: 25,  statuses: [], color: '#64748b' },
  { id: 'router', emoji: '🔗',    label: 'Router',    agent: 'PM2',   trigger: 'Polls every 2min', x: 710, y: 25, statuses: [], color: '#8b5cf6' },
  { id: 'medo',   emoji: '🐻',    label: 'Watchdog',  agent: 'Medo',  trigger: '⏰ Every 30min',   x: 940, y: 25, statuses: [], color: '#ef4444' },

  // === INTEL GATHERING (left side — feeds into Liso) ===
  { id: 'oti',   emoji: '🦦', label: 'Daily Pulse', agent: 'Oti',  trigger: '⏰ Daily 00:00',  x: 30,  y: 150, statuses: [],                 color: '#3b82f6' },
  { id: 'maci',  emoji: '🐱', label: 'Hunter',      agent: 'Mači', trigger: '⏰ Sun 02:00',    x: 30,  y: 370, statuses: [],                 color: '#10b981' },

  // === THE BRAIN (Liso combines all intel) ===
  { id: 'liso',  emoji: '🦊', label: 'The Brain',   agent: 'Liso', trigger: '🔗 Router',       x: 250, y: 260, statuses: ['backlog', 'todo'], color: '#f59e0b' },

  // === PRODUCTION LINE ===
  { id: 'pino',  emoji: '🕷️', label: 'Write',       agent: 'Pino', trigger: '🔗 Router',       x: 480, y: 260, statuses: ['writing'],         color: '#8b5cf6' },
  { id: 'rada',  emoji: '🦉', label: 'Edit',        agent: 'Rada', trigger: '🔗 Router',       x: 710, y: 260, statuses: ['review'],          color: '#f59e0b' },
  { id: 'zala',  emoji: '🎨', label: 'Design',      agent: 'Zala', trigger: '🔗 Router',       x: 940, y: 260, statuses: ['ready_for_design'],color: '#ec4899' },

  // === PUBLISHING (bottom, flows left) ===
  { id: 'lana',    emoji: '🕊️', label: 'Publish',   agent: 'Lana',      trigger: '🔗 Router',     x: 940, y: 500, statuses: ['ready'],             color: '#06b6d4' },
  { id: 'approve', emoji: '👤', label: 'Approve',   agent: 'Sebastjan', trigger: '📲 Telegram',    x: 710, y: 500, statuses: ['awaiting_approval'], color: '#f59e0b' },
  { id: 'live',    emoji: '✅', label: 'Published', agent: '',          trigger: '',               x: 480, y: 500, statuses: ['published'],         color: '#10b981' },

  // === AFTER PUBLISH (downstream) ===
  { id: 'bea',    emoji: '🐝', label: 'Social',    agent: 'Bea',   trigger: '🔗 Router',     x: 250, y: 500, statuses: [], color: '#10b981' },
  { id: 'bordi',  emoji: '🐕', label: 'Publish',   agent: 'Bordi', trigger: '🔗 Router',     x: 30,  y: 500, statuses: [], color: '#8b5cf6' },
];

const EDGES: Edge[] = [
  // === Intel → Brain ===
  { from: 'oti', to: 'liso', label: 'intel' },
  { from: 'maci', to: 'liso', label: 'gaps' },

  // === Production line ===
  { from: 'liso', to: 'pino', label: 'brief' },
  { from: 'pino', to: 'rada', label: 'draft' },
  { from: 'rada', to: 'pino', label: 'reject', dashed: true },
  { from: 'rada', to: 'zala', label: 'edited' },

  // === Publishing ===
  { from: 'zala', to: 'lana', label: 'HTML' },
  { from: 'lana', to: 'approve' },
  { from: 'approve', to: 'live', label: '✓' },

  // === Social pipeline ===
  { from: 'live', to: 'bea' },
  { from: 'bea', to: 'bordi', label: 'posts' },

  // === Feedback loop (Published → Vuk/Kroki → back to Liso) ===
  { from: 'live', to: 'kroki', dashed: true },
  { from: 'live', to: 'vuk', dashed: true },
  { from: 'vuk', to: 'liso', label: 'strategy' },

  // === Infrastructure ===
  { from: 'medo', to: 'router', dashed: true },
  { from: 'router', to: 'liso', dashed: true },
  { from: 'router', to: 'pino', dashed: true },
  { from: 'router', to: 'rada', dashed: true },
  { from: 'router', to: 'zala', dashed: true },
  { from: 'router', to: 'lana', dashed: true },
];

const NODE_W = 155;
const NODE_H = 88;
const INFRA_W = 120;
const INFRA_H = 64;
const SVG_W = 1120;
const SVG_H = 620;

function isInfraNode(id: string) {
  return id === 'router';
}

function nodeSize(node: Node) {
  return isInfraNode(node.id) ? { w: INFRA_W, h: INFRA_H } : { w: NODE_W, h: NODE_H };
}

function getNodeCenter(node: Node): { cx: number; cy: number } {
  const { w, h } = nodeSize(node);
  return { cx: node.x + w / 2, cy: node.y + h / 2 };
}

function getEdgePath(from: Node, to: Node): string {
  const a = getNodeCenter(from);
  const b = getNodeCenter(to);

  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return '';

  const fromS = nodeSize(from);
  const toS = nodeSize(to);
  const startX = a.cx + (dx / dist) * (fromS.w / 2.2);
  const startY = a.cy + (dy / dist) * (fromS.h / 2.2);
  const endX = b.cx - (dx / dist) * (toS.w / 2.2);
  const endY = b.cy - (dy / dist) * (toS.h / 2.2);

  const perpX = -(endY - startY) * 0.06;
  const perpY = (endX - startX) * 0.06;
  const midX = (startX + endX) / 2 + perpX;
  const midY = (startY + endY) / 2 + perpY;

  return `M${startX},${startY} Q${midX},${midY} ${endX},${endY}`;
}

export function FlowGraph({ stats }: FlowGraphProps) {
  const nodeMap = new Map(NODES.map(n => [n.id, n]));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full min-w-[700px]"
        style={{ maxHeight: '600px' }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--text-faint)" />
          </marker>
          <marker id="arrow-dim" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="6" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--text-faint)" opacity="0.35" />
          </marker>
        </defs>

        {/* Row labels */}
        {/* Section labels */}
        <text x="250" y="14" fill="var(--text-faint)" fontSize="9" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="0.1em">
          FEEDBACK LOOP
        </text>
        <text x="710" y="14" fill="var(--text-faint)" fontSize="9" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="0.1em">
          INFRASTRUCTURE
        </text>
        <text x="30" y="138" fill="var(--text-faint)" fontSize="9" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="0.1em">
          INTEL
        </text>
        <text x="480" y="248" fill="var(--text-faint)" fontSize="9" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="0.1em">
          PRODUCTION
        </text>
        <text x="710" y="488" fill="var(--text-faint)" fontSize="9" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="0.1em">
          PUBLISHING
        </text>

        {/* Edges */}
        {EDGES.map((edge, i) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const path = getEdgePath(from, to);

          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke="var(--text-faint)"
                strokeWidth={edge.dashed ? 1.2 : 2}
                strokeDasharray={edge.dashed ? '4 3' : 'none'}
                opacity={edge.dashed ? 0.35 : 0.55}
                markerEnd={edge.dashed ? 'url(#arrow-dim)' : 'url(#arrow)'}
              />
              {edge.label && !edge.dashed && (
                <text
                  x={(getNodeCenter(from).cx + getNodeCenter(to).cx) / 2}
                  y={(getNodeCenter(from).cy + getNodeCenter(to).cy) / 2 - 8}
                  textAnchor="middle"
                  fill="var(--text-faint)"
                  fontSize="10"
                  fontFamily="var(--font-sans)"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {NODES.map((node) => {
          const articleCount = node.statuses.reduce((sum, s) => sum + (stats[s]?.count ?? 0), 0);
          const isInfra = isInfraNode(node.id);
          const { w, h } = nodeSize(node);

          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={w}
                height={h}
                rx={isInfra ? 10 : 14}
                fill="var(--surface)"
                stroke={articleCount > 0 ? node.color : 'var(--border)'}
                strokeWidth={articleCount > 0 ? 1.5 : 1}
                opacity={isInfra ? 0.5 : 1}
              />

              {isInfra ? (
                <>
                  {/* Compact infra card */}
                  <text x={node.x + 12} y={node.y + 28} fontSize="20" dominantBaseline="central">
                    {node.emoji}
                  </text>
                  <text
                    x={node.x + 38}
                    y={node.y + 24}
                    fill="var(--text-primary)"
                    fontSize="13"
                    fontWeight="600"
                    fontFamily="var(--font-sans)"
                    opacity={0.6}
                  >
                    {node.label}
                  </text>
                  {node.trigger && (
                    <text x={node.x + 12} y={node.y + 50} fill="var(--text-faint)" fontSize="9" fontFamily="var(--font-sans)">
                      {node.trigger}
                    </text>
                  )}
                </>
              ) : (
                <>
                  {/* Emoji */}
                  <text x={node.x + 16} y={node.y + 36} fontSize="28" dominantBaseline="central">
                    {node.emoji}
                  </text>

                  {/* Label */}
                  <text
                    x={node.x + 50}
                    y={node.y + 28}
                    fill="var(--text-primary)"
                    fontSize="16"
                    fontWeight="600"
                    fontFamily="var(--font-sans)"
                  >
                    {node.label}
                  </text>

                  {/* Agent */}
                  {node.agent && (
                    <text x={node.x + 50} y={node.y + 46} fill="var(--text-tertiary)" fontSize="13" fontFamily="var(--font-sans)">
                      {node.agent}
                    </text>
                  )}

                  {/* Trigger type */}
                  {node.trigger && (
                    <text x={node.x + 16} y={node.y + 70} fill="var(--text-faint)" fontSize="10" fontFamily="var(--font-sans)">
                      {node.trigger}
                    </text>
                  )}
                </>
              )}

              {/* Article count badge */}
              {articleCount > 0 && (
                <g>
                  <circle cx={node.x + w - 16} cy={node.y + 16} r={11} fill={node.color} opacity={0.15} />
                  <text
                    x={node.x + w - 16}
                    y={node.y + 16}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={node.color}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {articleCount}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
