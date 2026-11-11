import React, { useEffect, useRef, useState } from 'react'
import ModelSelector from './ModelSelector'
import type { LogEntry } from '../electron'

interface Props {
  cwd: string
  onPickFolder: () => void
  acpStatus: string
  isProcessing: boolean
  contextPct: number | null
  currentModel: string
  onModelChange: (m: string) => void
}

export default function TitleBar({
  cwd, onPickFolder,
  acpStatus, isProcessing,
  contextPct,
  currentModel, onModelChange,
}: Props) {
  const api = window.electronAPI
  const dirName = cwd ? cwd.replace(/\\/g, '/').split('/').pop() ?? cwd : '…'

  const [logOpen, setLogOpen]       = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const logEndRef   = useRef<HTMLDivElement>(null)
  const logPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = api?.onLog((entry) =>
      setLogEntries((prev) => [...prev.slice(-400), entry])
    )
    return () => unsub?.()
  }, [])

  useEffect(() => {
    if (logOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logEntries, logOpen])

  // Fecha o popup ao clicar fora
  useEffect(() => {
    if (!logOpen) return
    const handler = (e: MouseEvent) => {
      if (logPanelRef.current && !logPanelRef.current.contains(e.target as Node)) {
        setLogOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [logOpen])

  const statusLabel = isProcessing      ? 'Processando'
    : acpStatus === 'ready'             ? 'Pronto'
    : acpStatus === 'connecting'        ? 'Conectando'
    : acpStatus === 'error'             ? 'Erro'
    : 'Desconectado'
  const statusCls = isProcessing ? 'generating' : acpStatus

  return (
    <div className="titlebar">
      <div className="tb-logo">
        <span className="tb-logo-brand">AceleraAI</span>
        <span className="tb-logo-app">Assistente de IA</span>
      </div>

      <div className="tb-divider" />

      {api && (
        <div className="tb-item">
          <span className="tb-item-label">Workspace</span>
          <button
            className="tb-dir-btn"
            onClick={onPickFolder}
            title={cwd || 'Clique para selecionar a pasta do workspace'}
          >
            <span className="tb-dir-icon">📁</span>
            <span className="tb-dir-name">{dirName}</span>
          </button>
        </div>
      )}

      <div className="tb-divider" />

      <div className="tb-item">
        <span className="tb-item-label">Status</span>
        <span className={`tb-conn-status ${statusCls}`}>
          {(isProcessing || acpStatus === 'connecting') && <span className="spin-icon">⟳</span>}
          {!isProcessing && acpStatus !== 'connecting' && <span className="tb-conn-dot" />}
          {statusLabel}
        </span>
      </div>

      {api && (
        <>
          <div className="tb-divider" />
          <div className="tb-item">
            <span className="tb-item-label">Modelo</span>
            <ModelSelector currentModel={currentModel} onModelChange={onModelChange} />
          </div>
        </>
      )}

      {contextPct != null && (
        <>
          <div className="tb-divider" />
          <div className="tb-item" title={`Janela de contexto: ${contextPct.toFixed(1)}% usada`}>
            <span className="tb-item-label">Ctx</span>
            <div className={`ctx-indicator${contextPct >= 80 ? ' ctx-danger' : contextPct >= 50 ? ' ctx-warn' : ''}`}>
              <div className="ctx-bar-track">
                <div className="ctx-bar-fill" style={{ width: `${Math.min(contextPct, 100)}%` }} />
              </div>
              <span className="ctx-label">{Math.round(contextPct)}%</span>
            </div>
          </div>
        </>
      )}

      <div className="tb-spacer" />

      {/* Botão de Log com popup flutuante */}
      <div className="tb-log-wrap" ref={logPanelRef}>
        <button
          className={`tb-log-btn${logOpen ? ' active' : ''}`}
          onClick={() => setLogOpen((v) => !v)}
          title="Log do kiro-cli"
        >
          Log {logEntries.length > 0 && <span className="tb-log-count">{logEntries.length > 99 ? '99+' : logEntries.length}</span>}
        </button>

        {logOpen && (
          <div className="tb-log-popup">
            <div className="tb-log-popup-header">
              <span>LOG KIRO-CLI</span>
              <button className="tb-log-popup-clear" onClick={() => setLogEntries([])}>Limpar</button>
              <button className="tb-log-popup-close" onClick={() => setLogOpen(false)}>✕</button>
            </div>
            <div className="tb-log-popup-entries">
              {logEntries.length === 0 && (
                <div className="tb-log-popup-empty">Nenhuma entrada de log ainda.</div>
              )}
              {logEntries.map((e, i) => (
                <div key={i} className={`tb-log-popup-entry${e.level === 'error' ? ' error' : e.level === 'raw' ? ' raw' : ''}`}>
                  <span className="tb-log-popup-badge">{e.level.toUpperCase()}</span>
                  <span className="tb-log-popup-msg">{e.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>

      <div className="tb-winbtns">
        <button className="tb-win-btn" onClick={() => api?.minimize()} title="Minimizar">─</button>
        <button className="tb-win-btn" onClick={() => api?.maximize()} title="Maximizar">□</button>
        <button className="tb-win-btn tb-win-close" onClick={() => api?.close()} title="Fechar">✕</button>
      </div>
    </div>
  )
}
