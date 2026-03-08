'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import AgentNodeComponent from '@/components/flow/AgentNode'
import AgentEdgeComponent from '@/components/flow/AgentEdge'
import AgentDetailPanel from '@/components/flow/AgentDetailPanel'
import WorkflowTimeline from '@/components/flow/WorkflowTimeline'
import type { FlowData, AgentNodeData } from '@/components/flow/types'

type FlowNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  style?: React.CSSProperties
}

type FlowEdge = {
  id: string
  source: string
  target: string
  type: string
  data?: Record<string, unknown>
  style?: React.CSSProperties
}

// Node types registration
const nodeTypes = { agentNode: AgentNodeComponent }
const edgeTypes = { agentEdge: AgentEdgeComponent }

// Fixed hierarchical layout positions
const LAYOUT: Record<string, { x: number; y: number }> = {
  main:       { x: 360, y: 0 },
  // Row 2
  ba:         { x: 180, y: 150 },
  researcher: { x: 360, y: 150 },
  sales:      { x: 540, y: 150 },
  // Row 3
  dev:        { x: 90,  y: 300 },
  ux:         { x: 270, y: 300 },
  devops:     { x: 450, y: 300 },
  cfo:        { x: 630, y: 300 },
  // Row 4
  qa:         { x: 0,   y: 450 },
  writer:     { x: 180, y: 450 },
  ciso:       { x: 360, y: 450 },
  ops:        { x: 540, y: 450 },
  marketing:  { x: 720, y: 450 },
  // Row 5 (extended team)
  webdev:     { x: 900, y: 300 },
}

function statusColor(status: string | undefined): string {
  if (status === 'running') return '#7c3aed'
  if (status === 'done') return '#22c55e'
  if (status === 'error') return '#ef4444'
  return '#2a2a2a'
}

function FlowCanvas() {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(null)
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const fetchRef = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/flow/agents')
      if (res.ok) {
        const data: FlowData = await res.json()
        setFlowData(data)
      }
    } catch {
      /* retry on next interval */
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (!fetchRef.current) {
      fetchRef.current = true
      fetchData()
    }
  }, [fetchData])

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  // SSE subscription for real-time updates
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource('/api/dashboard/stream')
      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'agent-status' || msg.type === 'agents') {
            fetchData()
          }
        } catch {
          /* ignore */
        }
      }
      es.onerror = () => {
        es?.close()
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [fetchData])

  // Get selected chain step agent IDs
  const highlightedAgents = useMemo(() => {
    if (!selectedChainId || !flowData) return new Set<string>()
    const chain = flowData.chains.find(c => c.id === selectedChainId)
    if (!chain) return new Set<string>()
    return new Set(chain.steps.map(s => s.agentId))
  }, [selectedChainId, flowData])

  // Convert data to React Flow nodes
  useEffect(() => {
    if (!flowData) return

    const runningAgents = new Set(
      flowData.agents.filter(a => a.status === 'running').map(a => a.id)
    )

    const newNodes: FlowNode[] = flowData.agents.map(agent => {
      const pos = LAYOUT[agent.id] || { x: 0, y: 0 }
      return {
        id: agent.id,
        type: 'agentNode',
        position: pos,
        data: agent as unknown as Record<string, unknown>,
        style: highlightedAgents.size > 0 && !highlightedAgents.has(agent.id)
          ? { opacity: 0.3, transition: 'opacity 0.3s' as const }
          : { opacity: 1, transition: 'opacity 0.3s' as const },
      }
    })

    const newEdges: FlowEdge[] = flowData.edges.map(edge => {
      const isActive = runningAgents.has(edge.target)
      const isHighlighted = highlightedAgents.size > 0 &&
        highlightedAgents.has(edge.source) &&
        highlightedAgents.has(edge.target)
      return {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'agentEdge',
        data: { count: edge.count, active: isActive || isHighlighted },
        style: highlightedAgents.size > 0 && !isHighlighted
          ? { opacity: 0.15 }
          : undefined,
      }
    })

    setNodes(newNodes)
    setEdges(newEdges)
  }, [flowData, highlightedAgents, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      const agent = flowData?.agents.find(a => a.id === node.id)
      if (agent) setSelectedAgent(agent)
    },
    [flowData]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedAgent(null)
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 600 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          style={{
            backgroundColor: '#0a0a0f',
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#2a2a2a"
          />
          <MiniMap
            style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
            }}
            nodeColor={(n) => statusColor((n.data as Record<string, unknown> | undefined)?.status as string | undefined)}
            maskColor="rgba(0,0,0,0.6)"
          />
          <Controls
            showInteractive={false}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />

          {/* Status Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: 'rgba(26, 26, 26, 0.8)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              gap: 12,
              zIndex: 10,
            }}
          >
            {[
              { label: 'Idle', color: '#888' },
              { label: 'Running', color: '#7c3aed' },
              { label: 'Done', color: '#22c55e' },
              { label: 'Error', color: '#ef4444' },
            ].map(s => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </ReactFlow>

        {/* Detail panel */}
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      </div>

      {/* Timeline panel */}
      <WorkflowTimeline
        chains={flowData?.chains || []}
        selectedChainId={selectedChainId}
        onSelectChain={setSelectedChainId}
      />
    </div>
  )
}

export default function FlowPage() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
