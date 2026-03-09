'use client'

interface SpawnEdgeProps {
  active: boolean
}

export default function SpawnEdge({ active }: SpawnEdgeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          width: 2,
          height: 40,
          background: active ? '#7c3aed' : '#374151',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {active && (
          <div
            style={{
              position: 'absolute',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#7c3aed',
              boxShadow: '0 0 8px #7c3aed',
              left: -2,
              animation: 'spawnEdgePulse 2s ease-in-out infinite',
            }}
          />
        )}
      </div>
      {/* Arrow */}
      <div style={{
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: `6px solid ${active ? '#7c3aed' : '#374151'}`,
      }} />
    </div>
  )
}
