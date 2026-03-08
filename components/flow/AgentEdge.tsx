'use client'
import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'

function AgentEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const edgeData = data as Record<string, unknown> | undefined
  const isActive = (edgeData?.active as boolean) ?? false
  const count = (edgeData?.count as number) ?? 1
  const strokeWidth = Math.min(Math.max(Math.log2(count + 1), 1), 4)

  return (
    <g>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isActive ? '#7c3aed' : '#2a2a2a'}
        strokeWidth={isActive ? strokeWidth + 1 : strokeWidth}
        strokeDasharray={isActive ? '6 4' : '4 4'}
        style={{
          animation: isActive ? 'edge-march 1s linear infinite' : undefined,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
        }}
      />
      {isActive && (
        <circle
          r={3}
          fill="#a78bfa"
          style={{
            offsetPath: `path('${edgePath}')`,
            offsetRotate: '0deg',
            animation: 'particle-travel 2s linear infinite',
            filter: 'drop-shadow(0 0 4px #a78bfa)',
          } as React.CSSProperties}
        />
      )}
    </g>
  )
}

export default memo(AgentEdgeComponent)
