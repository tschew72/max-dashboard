'use client'
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#1d2125', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ maxWidth: 480, width: '100%' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💥</div>
            <h1 style={{ color: '#ff8f73', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Global crash
            </h1>
            <div style={{
              background: '#ff563015', border: '1px solid #ff563040',
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <p style={{ color: '#ff8f73', fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
                {error?.message || 'Unknown error'}
              </p>
              {error?.stack && (
                <pre style={{ color: '#626f86', fontSize: 11, marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {error.stack.split('\n').slice(0, 10).join('\n')}
                </pre>
              )}
            </div>
            <button onClick={reset} style={{
              background: '#0052cc', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 24px', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', width: '100%',
            }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
