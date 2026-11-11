import React, { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../electron'

interface Props {
  open: boolean
  onClose: () => void
}

function timestamp(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

interface TimedEntry extends LogEntry {
  ts: string
  id: number
}

let _seq = 0

export default function LogPanel({ open, onClose }: Props) {
  const [entries, setEntries] = useState<TimedEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.electronAPI?.onLog((entry) => {
      setEntries((prev) => {
        const next = [...prev, { ...entry, ts: timestamp(), id: _seq++ }]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    })
    return () => { unsub?.() }
  }, [])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, open])

  if (!open) return null

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <span>LOG kiro-cli</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="log-clear-btn"
            onClick={() => setEntries([])}
            title="Limpar log"
          >
            Limpar
          </button>
          <button
            className="log-clear-btn"
            onClick={onClose}
            title="Fechar painel de log"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="log-entries">
        {entries.map((e) => (
          <div key={e.id} className={`log-entry log-entry-${e.level}`}>
            <span className="log-ts">{e.ts}</span>
            <span className={`log-badge log-badge-${e.level}`}>{e.level}</span>
            <span className="log-msg">{e.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
