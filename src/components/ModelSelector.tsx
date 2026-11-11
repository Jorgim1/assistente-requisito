import React, { useEffect, useRef, useState } from 'react'
import type { KiroModel } from '../electron'

function shortName(m: KiroModel): string {
  // Remove prefixos longos para deixar o label compacto
  return m.model_name
    .replace('claude-', '')
    .replace('gpt-', 'GPT ')
    .replace('deepseek-', 'DeepSeek ')
    .replace('qwen3-', 'Qwen3 ')
}

function rateLabel(r: number): string {
  return `${r}×`
}

function rateColor(r: number): string {
  if (r <= 0.25) return 'model-rate-cheap'
  if (r <= 1.0)  return 'model-rate-normal'
  if (r <= 2.2)  return 'model-rate-mid'
  return 'model-rate-expensive'
}

export default function ModelSelector({
  currentModel,
  onModelChange,
}: {
  currentModel: string
  onModelChange: (modelId: string) => void
}) {
  const [open, setOpen]     = useState(false)
  const [models, setModels] = useState<KiroModel[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Carrega modelos ao abrir pela primeira vez
  const handleOpen = async () => {
    setOpen((v) => !v)
    if (models.length === 0 && !loading) {
      setLoading(true)
      try {
        const list = await window.electronAPI?.listModels() ?? []
        setModels(list)
      } catch {
        // mantém lista vazia; usuário pode tentar reabrir
      } finally {
        setLoading(false)
      }
    }
  }

  const current = models.find((m) => m.model_id === currentModel)
  const displayLabel = current ? shortName(current) : currentModel === 'auto' ? 'auto' : currentModel

  const handleSelect = (modelId: string) => {
    onModelChange(modelId)
    setOpen(false)
  }

  return (
    <div className="model-selector" ref={ref}>
      <button
        className={`model-btn${open ? ' open' : ''}`}
        onClick={handleOpen}
        title="Escolher modelo"
      >
        <span className="model-btn-icon">◆</span>
        <span className="model-btn-label">{displayLabel}</span>
        <span className="model-btn-arrow">{open ? '▲' : '▾'}</span>
      </button>

      {open && (
        <div className="model-dropdown">
          <div className="model-dropdown-title">Modelo</div>
          {loading && <div className="model-dropdown-loading">Carregando…</div>}
          {models.map((m) => (
            <button
              key={m.model_id}
              className={`model-option${m.model_id === currentModel ? ' selected' : ''}`}
              onClick={() => handleSelect(m.model_id)}
              title={m.description}
            >
              <span className="model-option-name">{shortName(m)}</span>
              <span className={`model-option-rate ${rateColor(m.rate_multiplier)}`}>
                {rateLabel(m.rate_multiplier)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
