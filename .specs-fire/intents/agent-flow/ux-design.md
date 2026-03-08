# UX Design Spec — Agent Orchestration Flow Visualizer
**Designer:** Umi 🎨  
**Date:** 2026-03-08  
**Status:** Ready for Dev  
**Bea Spec:** `/root/projects/max-dashboard/.specs-fire/intents/agent-flow/brief.md` *(pending — design based on task brief)*

---

## Overview

A live canvas visualizing Max's 13 AI agents as interactive nodes with directed edges showing spawn relationships and live work flow. Think n8n meets system observability — dark, purposeful, no noise.

**Tech stack:** React Flow + CSS animations + shadcn/ui panels

---

## 1. Node Visual Design

### Agent Roster (all 13 nodes)

| Agent | Emoji | Role Badge |
|-------|-------|------------|
| Max | ⚡ | Orchestrator |
| Bea | 📋 | Business Analyst |
| Dev | 💻 | Full-Stack Engineer |
| Umi | 🎨 | UX Designer |
| Alex | 🔍 | Researcher |
| Sam | 📈 | Sales |
| Quinn | 🧪 | QA Engineer |
| Dex | 🚀 | DevOps |
| Cleo | 💰 | CFO |
| Kai | 🛡️ | CISO |
| Wren | ✍️ | Writer |
| Ops | ⚙️ | Operations |
| Maya | 📣 | Marketing |

### Node Dimensions
- **Size:** 120×80px
- **Border radius:** 10px
- **Font:** system-ui, sans-serif

### Visual States

#### Default (Idle)
```css
.agent-node--idle {
  background: var(--card);           /* #1a1a1a */
  border: 1px solid var(--border);   /* #2a2a2a */
  box-shadow: 0 0 8px rgba(124, 58, 237, 0.08);
  transition: all 0.2s ease;
}
.agent-node--idle .node-name {
  color: var(--muted);               /* #888 — dimmed */
}
.agent-node--idle::before {
  /* dim ambient glow */
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 11px;
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.05);
  pointer-events: none;
}
```

#### Running
```css
.agent-node--running {
  background: var(--card);
  border: 2px solid var(--accent);   /* #7c3aed */
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.35), 0 0 40px rgba(124, 58, 237, 0.15);
  animation: node-bg-pulse 2s ease-in-out infinite;
}
.agent-node--running .node-name {
  color: var(--text);                /* #f0f0f0 — brightened */
  font-weight: 600;
}
/* Spinning arc overlay — rendered as ::after pseudo on node wrapper */
.agent-node--running::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 13px;
  border: 2px solid transparent;
  border-top-color: var(--accent);
  border-right-color: rgba(124, 58, 237, 0.4);
  animation: node-ring-running 1s linear infinite;
}

@keyframes node-bg-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(124, 58, 237, 0.35), 0 0 40px rgba(124, 58, 237, 0.15); }
  50%       { box-shadow: 0 0 30px rgba(124, 58, 237, 0.55), 0 0 60px rgba(124, 58, 237, 0.25); }
}
```

#### Done (Recent — fades over 3s)
```css
.agent-node--done {
  border: 2px solid #22c55e;
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.3);
  animation: node-done-fadeout 3s ease-out forwards;
}
/* Green checkmark overlay — absolutely positioned top-right */
.agent-node--done .node-check {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: white;
  animation: node-done-fadeout 3s ease-out forwards;
}

@keyframes node-done-fadeout {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; border-color: transparent; box-shadow: none; }
}
```

#### Error
```css
.agent-node--error {
  border: 2px solid #ef4444;
  box-shadow: 0 0 16px rgba(239, 68, 68, 0.3);
  animation: node-error-shake 0.4s ease-in-out 3;
}

@keyframes node-error-shake {
  0%   { transform: translateX(0); }
  25%  { transform: translateX(4px); }
  75%  { transform: translateX(-4px); }
  100% { transform: translateX(0); }
}
```

#### Hover
```css
.agent-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px rgba(124, 58, 237, 0.2);
  cursor: pointer;
  border-color: rgba(124, 58, 237, 0.4);
}
```

### Node Internal Layout (120×80px)
```
┌──────────────────────────────┐
│  [emoji 24px]   [status dot] │  ← row 1: 8px padding, flex space-between
│  Agent Name                  │  ← row 2: 13px semibold
│  [role badge pill]           │  ← row 3: 10px muted text, 4px pill bg
└──────────────────────────────┘
```

**Role badge:** `background: rgba(124,58,237,0.12); color: var(--accent-light); font-size: 10px; padding: 2px 6px; border-radius: 100px;`

**Status dot:** 6px circle, top-right corner. Colors: `#888` idle, `#7c3aed` running, `#22c55e` done, `#ef4444` error

### TypeScript Interface

```typescript
// /root/projects/max-dashboard/components/agent-flow/types.ts

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

export interface AgentNodeData {
  id: string;                    // e.g. 'main', 'ba', 'dev'
  name: string;                  // e.g. 'Max', 'Bea', 'Dev'
  emoji: string;                 // e.g. '⚡', '📋', '💻'
  role: string;                  // e.g. 'Orchestrator', 'Business Analyst'
  model: 'opus' | 'sonnet' | 'haiku' | string;
  status: AgentStatus;
  lastRunAt?: Date;
  currentTaskId?: string;
  runCount7d?: number[];         // 7 daily counts for sparkline
  lastRuns?: AgentRun[];         // last 5 runs for detail panel
}

export interface AgentRun {
  id: string;
  startedAt: Date;
  durationMs: number;
  costUsd?: number;
  status: AgentStatus;
}

export interface AgentEdgeData {
  state: 'default' | 'active' | 'recent';
  lastActivityAt?: Date;
}
```

---

## 2. Edge Visual Design

Edges represent spawn relationships: `spawner → spawned`. Rendered as SVG paths via React Flow.

### Edge States

#### Default (Inactive)
```css
.react-flow__edge-path--default {
  stroke: #2a2a2a;
  stroke-width: 1;
  stroke-dasharray: 4 4;
  fill: none;
}
```

#### Active (Work Flowing — marching ants)
```css
.react-flow__edge-path--active {
  stroke: #7c3aed;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  fill: none;
  animation: edge-march 1s linear infinite;
}

@keyframes edge-march {
  0%   { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
```

#### Recent (Last 5 min — fading to dashed)
```css
.react-flow__edge-path--recent {
  stroke: rgba(124, 58, 237, 0.2);  /* #7c3aed20 */
  stroke-width: 1;
  stroke-dasharray: none;           /* solid → transitions to dashed */
  fill: none;
  transition: stroke-dasharray 2s ease, stroke 3s ease;
}
```

### Particle Animation

Each active edge renders a travelling glowing dot via a sibling `<circle>` element using `offsetPath`:

```typescript
// EdgeParticle component — rendered per active edge
// Uses SVG <circle> with CSS offset-path matching the edge path

// CSS:
.edge-particle {
  width: 4px;
  height: 4px;
  background: #a78bfa;
  border-radius: 50%;
  box-shadow: 0 0 6px #a78bfa, 0 0 12px rgba(167, 139, 250, 0.5);
  position: absolute;
  offset-rotate: 0deg;
  animation: edge-particle 2s linear infinite;
}

@keyframes edge-particle {
  0%   { offset-distance: 0%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
```

---

## 3. Canvas Layout

### Background
```css
.agent-flow-canvas {
  width: 100%;
  height: 100%;
  background-color: #0a0a0f;  /* deeper than --bg for contrast */
  background-image: radial-gradient(circle, #2a2a2a 1px, transparent 1px);
  background-size: 24px 24px;
}
```

### Chrome Elements

**Mini-map** — bottom-right, React Flow `<MiniMap>`:
```tsx
<MiniMap
  style={{
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
  }}
  nodeColor={(node) => {
    const status = node.data?.status;
    if (status === 'running') return '#7c3aed';
    if (status === 'done') return '#22c55e';
    if (status === 'error') return '#ef4444';
    return '#2a2a2a';
  }}
  maskColor="rgba(0,0,0,0.6)"
/>
```

**Controls** — top-right, React Flow `<Controls>`:
```css
.react-flow__controls {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.react-flow__controls-button {
  background: transparent;
  border: none;
  color: var(--muted);
}
.react-flow__controls-button:hover {
  background: rgba(124, 58, 237, 0.1);
  color: var(--accent-light);
}
```

**Status Legend** — bottom-left, custom component:
```
┌───────────────────────────┐
│ ● Idle   ● Running        │
│ ● Done   ● Error          │
└───────────────────────────┘
```
```tsx
// Position: absolute bottom-left, margin 16px
// Each item: 8px dot + 12px label text (var(--muted))
// Dot colors: #888, #7c3aed, #22c55e, #ef4444
// Background: rgba(26,26,26,0.8), backdrop-filter: blur(8px)
// Border: 1px solid #2a2a2a, border-radius: 8px, padding: 8px 12px
```

### Default Node Layout (13 agents, auto-arranged)

Suggested initial positions using a hub-and-spoke layout with Max at center:
```
Max (center: 500, 300)
├── Bea (250, 150)
├── Dev (750, 150)
├── Umi (250, 450)
├── Quinn (750, 450)
├── Alex (500, 100)
├── Sam (900, 300)
├── Dex (500, 500)
├── Cleo (100, 300)
├── Kai (150, 150)
├── Wren (850, 150)
├── Ops (850, 450)
└── Maya (150, 450)
```

---

## 4. Workflow Timeline (Bottom Panel)

### Layout
- **Height:** 120px (fixed)
- **Position:** bottom of viewport, above any nav
- **Background:** `var(--card)` with top border `1px solid var(--border)`
- **Overflow-x:** auto (horizontal scroll)
- **Padding:** 12px 16px

### Timeline Row Structure
Each row = one workflow chain execution:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 14:32  [Max ⚡]→[Bea 📋]→[Dev 💻]→[Quinn 🧪]                   3m 42s │
│ 14:15  [Max ⚡]→[Kai 🛡️]                                           58s │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pill Component
```css
.timeline-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.timeline-pill--success  { background: rgba(34,197,94,0.12);  color: #22c55e; }
.timeline-pill--running  { background: rgba(234,179,8,0.12);  color: #eab308; }
.timeline-pill--failed   { background: rgba(239,68,68,0.12);  color: #ef4444; }

.timeline-arrow {
  color: var(--muted);
  font-size: 12px;
  padding: 0 2px;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.timeline-row--selected {
  outline: 1px solid #7c3aed;
  background: rgba(124, 58, 237, 0.05);
  padding: 6px 8px;
}
.timeline-row:hover:not(.timeline-row--selected) {
  background: rgba(255,255,255,0.03);
}

.timeline-timestamp {
  font-size: 11px;
  color: var(--muted);
  min-width: 40px;
  flex-shrink: 0;
}
.timeline-duration {
  font-size: 11px;
  color: var(--muted);
  min-width: 40px;
  text-align: right;
  flex-shrink: 0;
  margin-left: auto;
}
```

---

## 5. Node Detail Slide Panel

### Layout
- **Width:** 320px
- **Position:** fixed right, full viewport height
- **Background:** `var(--card)`
- **Border-left:** `1px solid var(--border)`
- **Transition:** `transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)`
- **Closed:** `translateX(100%)` | **Open:** `translateX(0)`
- **z-index:** 50 (above canvas, below modals)
- **Overflow-y:** auto

### Panel Content Structure (top → bottom)

```
┌────────────────────────────────┐
│ [×]                            │  ← close button top-right 
│                                │
│     💻                         │  ← emoji 48px, centered
│   Dev                          │  ← 20px semibold
│   Full-Stack Engineer          │  ← 13px muted
│   [sonnet badge]  [● running]  │  ← model + status row
│ ─────────────────────────────  │
│ Last 5 Runs                    │
│  14:32  45s  $0.002  ●         │
│  13:10  2m   $0.008  ●         │
│  12:05  30s  $0.001  ●         │
│  11:44  1m   $0.004  ●         │
│  09:22  1m   $0.003  ●  (err)  │
│ ─────────────────────────────  │
│ Daily Runs (7d)                │
│ [▁▂▃▅▂▆▄ sparkline SVG]       │
│ ─────────────────────────────  │
│ [    Spawn Task    ]           │  ← purple full-width button
└────────────────────────────────┘
```

### Panel CSS

```css
.agent-detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  background: var(--card);
  border-left: 1px solid var(--border);
  z-index: 50;
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.agent-detail-panel.open {
  transform: translateX(0);
  box-shadow: -8px 0 32px rgba(0,0,0,0.4);
}

.panel-emoji { font-size: 48px; text-align: center; }
.panel-name  { font-size: 20px; font-weight: 600; text-align: center; color: var(--text); }
.panel-role  { font-size: 13px; color: var(--muted); text-align: center; }

.panel-badges {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}
.model-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
  background: rgba(124,58,237,0.15);
  color: var(--accent-light);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.runs-table {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 4px 0;
  border-bottom: 1px solid rgba(42,42,42,0.5);
}
.run-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.run-dot--success { background: #22c55e; }
.run-dot--error   { background: #ef4444; }

.sparkline-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

.spawn-button {
  width: 100%;
  padding: 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  margin-top: auto;
}
.spawn-button:hover {
  background: #6d28d9;
  transform: translateY(-1px);
}
.spawn-button:active {
  transform: translateY(0);
}
```

### Sparkline SVG Spec (7-day run count)

```tsx
// Simple polyline SVG, no labels, no axes — just the shape
// Width: 100%, Height: 36px
// Stroke: var(--accent-light) #a78bfa, stroke-width: 1.5
// Fill: gradient rgba(167,139,250,0.1) → transparent
// Point: small circle (2px radius) at each data point
// Normalize: map max(runCount7d) → 30px height, min → 6px
```

---

## 6. Animation Timing Spec

```css
/* ── Keyframes ──────────────────────────────────────────────── */

/* Idle ambient pulse — applies to status dot only when idle */
@keyframes node-pulse-idle {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}

/* Running ring rotation — applies to ::after pseudo-element */
@keyframes node-ring-running {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Done state ring/check fade out */
@keyframes node-done-fadeout {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}

/* Error shake — 3 iterations via animation-iteration-count */
@keyframes node-error-shake {
  0%   { transform: translateX(0); }
  25%  { transform: translateX(4px); }
  75%  { transform: translateX(-4px); }
  100% { transform: translateX(0); }
}

/* Edge particle travel */
@keyframes edge-particle {
  0%   { offset-distance: 0%;   opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}

/* Edge marching ants */
@keyframes edge-march {
  0%   { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}

/* ── Application ──────────────────────────────────────────── */

.node-dot--idle    { animation: node-pulse-idle    3s ease-in-out infinite; }
.node--running::after { animation: node-ring-running  1s linear     infinite; }
.node--done        { animation: node-done-fadeout  3s ease-out    forwards; }
.node--error       { animation: node-error-shake   0.4s ease-in-out 3; }
.edge-particle     { animation: edge-particle      2s linear     infinite; }
.edge--active path { animation: edge-march         1s linear     infinite; }
```

---

## 7. React Flow Custom Node Component Structure

```typescript
// /root/projects/max-dashboard/components/agent-flow/AgentNode.tsx

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { AgentNodeData } from './types';

function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const { emoji, name, role, status, model } = data;

  return (
    <div
      className={[
        'agent-node',
        `agent-node--${status}`,
        selected ? 'agent-node--selected' : '',
      ].join(' ')}
      style={{ width: 120, height: 80, position: 'relative' }}
    >
      {/* Incoming edge handle — left center */}
      <Handle type="target" position={Position.Left} />

      {/* Status dot */}
      <span className={`node-dot node-dot--${status}`} />

      {/* Done checkmark */}
      {status === 'done' && (
        <span className="node-check" aria-label="completed">✓</span>
      )}

      {/* Node content */}
      <div className="node-inner">
        <span className="node-emoji" aria-hidden="true">{emoji}</span>
        <span className="node-name">{name}</span>
        <span className="node-role-badge">{role}</span>
      </div>

      {/* Outgoing edge handle — right center */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(AgentNode);
```

```typescript
// /root/projects/max-dashboard/components/agent-flow/AgentEdge.tsx

import { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import type { AgentEdgeData } from './types';

function AgentEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps<AgentEdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const state = data?.state ?? 'default';

  return (
    <g className={`agent-edge agent-edge--${state}`}>
      {/* Main path */}
      <path
        id={id}
        d={edgePath}
        className="react-flow__edge-path"
        fill="none"
      />

      {/* Particle dot — only when active */}
      {state === 'active' && (
        <circle
          r={2}
          fill="#a78bfa"
          filter="url(#particle-glow)"
          style={{
            offsetPath: `path('${edgePath}')`,
            offsetRotate: '0deg',
          } as React.CSSProperties}
          className="edge-particle"
        />
      )}

      {/* SVG filter for particle glow */}
      <defs>
        <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </g>
  );
}

export default memo(AgentEdge);
```

```typescript
// /root/projects/max-dashboard/components/agent-flow/FlowCanvas.tsx
// Main canvas composition

import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import AgentNode from './AgentNode';
import AgentEdge from './AgentEdge';
import StatusLegend from './StatusLegend';
import WorkflowTimeline from './WorkflowTimeline';
import AgentDetailPanel from './AgentDetailPanel';

const nodeTypes = { agentNode: AgentNode };
const edgeTypes = { agentEdge: AgentEdge };

export function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(null);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Canvas area — fills remaining height */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => setSelectedAgent(node.data)}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
          className="agent-flow-canvas"
        >
          <MiniMap
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
            nodeColor={(n) => statusColor(n.data?.status)}
            maskColor="rgba(0,0,0,0.6)"
          />
          <Controls showInteractive={false} />
          <StatusLegend />
        </ReactFlow>

        {/* Detail panel slides in from right */}
        <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      </div>

      {/* Timeline panel — fixed height at bottom */}
      <WorkflowTimeline height={120} />
    </div>
  );
}
```

---

## 8. File Structure

```
/root/projects/max-dashboard/
├── app/
│   └── (dashboard)/
│       └── agent-flow/
│           └── page.tsx              ← Route: /agent-flow
├── components/
│   └── agent-flow/
│       ├── AgentNode.tsx             ← Custom node component
│       ├── AgentEdge.tsx             ← Custom edge component
│       ├── FlowCanvas.tsx            ← Main canvas composition
│       ├── WorkflowTimeline.tsx      ← Bottom timeline panel
│       ├── AgentDetailPanel.tsx      ← Right slide panel
│       ├── StatusLegend.tsx          ← Bottom-left legend
│       ├── Sparkline.tsx             ← SVG sparkline component
│       ├── types.ts                  ← TypeScript interfaces
│       └── agent-flow.css            ← All animation keyframes + node styles
└── .specs-fire/
    └── intents/
        └── agent-flow/
            ├── brief.md              ← Bea's spec (pending)
            └── ux-design.md          ← This file
```

---

## 9. Interaction Behaviour

| Trigger | Action |
|---------|--------|
| Click node | Open detail panel (slide in from right) |
| Click canvas bg | Close detail panel |
| Click timeline row | Highlight corresponding edge chain on canvas |
| Hover node | Lift animation + cursor pointer |
| Scroll canvas | Zoom (React Flow default) |
| Pinch/two-finger | Zoom (touch devices) |
| Double-click canvas | Fit view |

---

## 10. Accessibility

- All emoji have `aria-hidden="true"` — name/role text provides context
- Status dots have `aria-label` matching status text
- Detail panel has `role="complementary"` + `aria-label="Agent details"`
- Close button has `aria-label="Close panel"`
- Focus trap in detail panel when open
- Keyboard: `Escape` closes detail panel
- Color is never the only indicator — text labels accompany all status colors
- Contrast: muted text (#888 on #1a1a1a) = 4.1:1, meets AA for UI components

---

## Dev Handoff Notes

1. **Library:** `reactflow` v11+ required. Install: `npm install reactflow`
2. **`proOptions={{ hideAttribution: true }}`** requires React Flow Pro license or self-hosting — remove if not licensed
3. **`offset-path` CSS** has good browser support (Chrome/Edge/Firefox 116+) but verify Safari; fallback: skip particle, keep marching ants
4. **Initial node positions** should be persisted to localStorage so users can drag nodes and return to their layout
5. **Real-time data:** poll `/api/agent-status` every 5s or use SSE for live status updates — the `AgentNodeData.status` field drives all visual state
6. **`statusColor()` helper** needed in FlowCanvas for minimap: `idle→#2a2a2a, running→#7c3aed, done→#22c55e, error→#ef4444`
7. **`initialNodes`/`initialEdges`** should be built from AGENT-REGISTRY data; Max is always center node
8. **Timeline data source:** `/api/workflow-runs` — returns completed chains with agent sequences, timestamps, durations
