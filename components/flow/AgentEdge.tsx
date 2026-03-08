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
  const isActive = edgeData?.active === true  // strict boolean check
  const count = (edgeData?.count as number) ?? 1
  const baseWidth = Math.min(Math.max(Math.log2(count + 1), 1), 3)

  const activeColor = '#7c3aed'
  const activeColorLight = '#a78bfa'
  const idleColor = 'rgba(255,255,255,0.06)'
  const recentColor = 'rgba(124,58,237,0.3)'

  const strokeColor = isActive ? activeColor : (count > 0 ? recentColor : idleColor)

  return (
    <g>
      {/* Unique defs for this edge */}
      <defs>
        <linearGradient id={`edge-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={activeColor} />
          <stop offset="100%" stopColor={activeColorLight} />
        </linearGradient>
        <filter id={`edge-blur-${id}`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`particle-glow-${id}`}>
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Layer 1: Thick blurred glow path */}
      <path
        d={edgePath}
        fill="none"
        stroke={isActive ? activeColor : strokeColor}
        strokeWidth={isActive ? baseWidth + 3 : baseWidth + 1}
        opacity={isActive ? 0.3 : 0.15}
        filter={`url(#edge-blur-${id})`}
        style={{ transition: 'stroke 0.6s ease, opacity 0.6s ease' }}
      />

      {/* Layer 2: Crisp center line */}
      <path
        id={`edge-path-${id}`}
        d={edgePath}
        fill="none"
        stroke={isActive ? `url(#edge-grad-${id})` : strokeColor}
        strokeWidth={isActive ? baseWidth : Math.max(baseWidth * 0.7, 0.5)}
        strokeLinecap="round"
        style={{ transition: 'stroke 0.6s ease, stroke-width 0.3s ease' }}
      />

      {/* Layer 3: Particle stream — only when active */}
      {isActive && (
        <>
          <circle
            r={3}
            fill={activeColorLight}
            filter={`url(#particle-glow-${id})`}
            style={{
              offsetPath: `path('${edgePath}')`,
              offsetRotate: '0deg',
              animation: 'edge-particle 2s linear infinite',
              opacity: 1,
            } as React.CSSProperties}
          />
          <circle
            r={2.5}
            fill={activeColorLight}
            filter={`url(#particle-glow-${id})`}
            style={{
              offsetPath: `path('${edgePath}')`,
              offsetRotate: '0deg',
              animation: 'edge-particle 2s linear infinite',
              animationDelay: '-0.66s',
              opacity: 0.7,
            } as React.CSSProperties}
          />
          <circle
            r={2}
            fill={activeColorLight}
            style={{
              offsetPath: `path('${edgePath}')`,
              offsetRotate: '0deg',
              animation: 'edge-particle 2s linear infinite',
              animationDelay: '-1.33s',
              opacity: 0.4,
            } as React.CSSProperties}
          />
        </>
      )}

      {/* Layer 4: Arrow head */}
      {isActive && (
        <circle
          r={4}
          fill={activeColor}
          style={{
            offsetPath: `path('${edgePath}')`,
            offsetDistance: '100%',
            offsetRotate: '0deg',
            filter: `drop-shadow(0 0 6px ${activeColor})`,
          } as React.CSSProperties}
        />
      )}
    </g>
  )
}

export default memo(AgentEdgeComponent)
