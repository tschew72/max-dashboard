'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
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

const nodeTypes = { agentNode: AgentNodeComponent }
const edgeTypes = { agentEdge: AgentEdgeComponent }

const LAYOUT: Record<string, { x: number; y: number }> = {
  main:       { x: 360, y: 0 },
  ba:         { x: 180, y: 150 },
  researcher: { x: 360, y: 150 },
  sales:      { x: 540, y: 150 },
  dev:        { x: 90,  y: 300 },
  ux:         { x: 270, y: 300 },
  devops:     { x: 450, y: 300 },
  cfo:        { x: 630, y: 300 },
  qa:         { x: 0,   y: 450 },
  writer:     { x: 180, y: 450 },
  ciso:       { x: 360, y: 450 },
  ops:        { x: 540, y: 450 },
  marketing:  { x: 720, y: 450 },
  webdev:     { x: 900, y: 300 },
}

function statusColor(status: string | undefined): string {
  if (status === 'running') return '#7c3aed'
  if (status === 'done') return '#22c55e'
  if (status === 'error') return '#ef4444'
  return '#1e1e2e'
}

function FlowCanvas() {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeData | null>(null)
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const fetchRef = useRef(false)
  const nodesRef = useRef(nodes)

  // Keep nodesRef in sync for use inside SSE handler
  useEffect(() => { nodesRef.current = nodes }, [nodes])

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

  // SSE subscription for real-time status updates (replaces 15s poll)
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource('/api/flow/stream')

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'agent-status') {
            // Update just that one node's status — instant, no full refetch
            setNodes(prev => prev.map(node => {
              if (node.id !== msg.agentId) return node
              return {
                ...node,
                data: { ...node.data, status: msg.status },
              }
            }))

            // Update edges: edge is active when BOTH endpoints are running
            setEdges(prev => prev.map(edge => {
              if (edge.source !== msg.agentId && edge.target !== msg.agentId) return edge
              const currentNodes = nodesRef.current
              const sourceNode = currentNodes.find(n => n.id === edge.source)
              const targetNode = currentNodes.find(n => n.id === edge.target)
              const sourceRunning = edge.source === msg.agentId
                ? msg.status === 'running'
                : (sourceNode?.data as Record<string, unknown>)?.status === 'running'
              const targetRunning = edge.target === msg.agentId
                ? msg.status === 'running'
                : (targetNode?.data as Record<string, unknown>)?.status === 'running'
              return {
                ...edge,
                data: { ...edge.data, active: sourceRunning && targetRunning },
              }
            }))
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es?.close()
        // SSE dropped — fall back to single refetch after 5s, then reconnect
        reconnectTimeout = setTimeout(() => {
          fetchData()
          connect()
        }, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [fetchData, setNodes, setEdges])

  // 30s fallback poll (reduced from 15s — SSE handles real-time)
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const highlightedAgents = useMemo(() => {
    if (!selectedChainId || !flowData) return new Set<string>()
    const chain = flowData.chains.find(c => c.id === selectedChainId)
    if (!chain) return new Set<string>()
    return new Set(chain.steps.map(s => s.agentId))
  }, [selectedChainId, flowData])

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
      <div style={{ flex: 1, position: 'relative', minHeight: 600 }}>
        {/* Corner ambient glows */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            left: -50,
            width: 300,
            height: 300,
            background: 'rgba(124,58,237,0.08)',
            borderRadius: '50%',
            filter: 'blur(80px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 400,
            height: 400,
            background: 'rgba(59,130,246,0.05)',
            borderRadius: '50%',
            filter: 'blur(100px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

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
            backgroundColor: '#0a0a12',
            backgroundImage: [
              'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.03) 0%, transparent 60%)',
              'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        >
          <MiniMap
            style={{
              background: '#0d0d1a',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
            }}
            nodeColor={(n) => statusColor((n.data as Record<string, unknown> | undefined)?.status as string | undefined)}
            maskColor="rgba(10,10,18,0.85)"
          />
          <Controls
            showInteractive={false}
            style={{
              background: 'rgba(13,13,26,0.8)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
            }}
          />

          {/* Status Legend — glass card, bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: 'rgba(13,13,26,0.7)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 10,
            }}
          >
            {[
              { label: 'Idle', color: '#6b7280' },
              { label: 'Running', color: '#7c3aed' },
              { label: 'Done', color: '#22c55e' },
              { label: 'Error', color: '#ef4444' },
            ].map(s => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8' }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: s.color,
                  boxShadow: `0 0 6px ${s.color}`,
                  flexShrink: 0,
                }} />
                {s.label}
              </span>
            ))}
          </div>
        </ReactFlow>

        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      </div>

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
