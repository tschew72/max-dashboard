'use client'
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  createdAt: number
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const ICONS = {
  success: <CheckCircle2 size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
}

const COLORS = {
  success: { bg: '#0d1f12', border: '#1a4d27', color: '#3fb950', icon: '#3fb950' },
  error: { bg: '#2d1515', border: '#5a1d1d', color: '#f85149', icon: '#f85149' },
  info: { bg: '#0d1a2e', border: '#1f3a5f', color: '#388bfd', icon: '#388bfd' },
}

const TIMEOUTS = { success: 3000, error: 5000, info: 3000 }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) { clearTimeout(timer); timersRef.current.delete(id) }
  }, [])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => {
      const next = [...prev, { id, type, message, createdAt: Date.now() }]
      return next.slice(-3) // max 3
    })
    const timer = setTimeout(() => dismiss(id), TIMEOUTS[type])
    timersRef.current.set(id, timer)
  }, [dismiss])

  useEffect(() => {
    return () => { timersRef.current.forEach(t => clearTimeout(t)) }
  }, [])

  const value: ToastContextValue = {
    toast: addToast,
    success: (msg) => addToast('success', msg),
    error: (msg) => addToast('error', msg),
    info: (msg) => addToast('info', msg),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 8,
          width: '90%',
          maxWidth: 400,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => {
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                pointerEvents: 'auto',
                animation: 'toastSlideUp 0.25s ease-out',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ color: c.icon, flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ color: c.color, fontSize: 13, fontWeight: 500, flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{ color: c.color, opacity: 0.6, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
