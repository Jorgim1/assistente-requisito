import React, { useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Project, Artifact, AgentUpdate } from '../electron'

type Step = 'input' | 'streaming' | 'done'

interface Props {
  acpStatus: string
  onProcessingChange?: (v: boolean) => void
  activeProject?: Project | null
  onArtifactSaved?: (artifact: Artifact) => void
  selectedArtifactIds: Set<string>
  artifacts: Record<string, Artifact[]>
}

export default function DerivationPanel({
  acpStatus,
  onProcessingChange,
  activeProject,
  onArtifactSaved,
  selectedArtifactIds,
  artifacts,
}: Props) {
  const [step, setStep]           = useState<Step>('input')
  const [lacunasText, setLacunasText] = useState('')
  const [isProcessing, setIsProcessingLocal] = useState(false)
  const [savedArtifact, setSavedArtifact] = useState<Artifact | null>(null)

  const stepRef         = useRef<Step>('input')
  const isProcessingRef = useRef(false)
  const lacunasAccRef   = useRef('')
  const lacunasEndRef   = useRef<HTMLDivElement>(null)

  stepRef.current = step

  const allArtifacts      = Object.values(artifacts).flat()
  const selectedArtifacts = allArtifacts.filter((a) => selectedArtifactIds.has(a.id))

  useEffect(() => {
    window.electronAPI?.derivation?.activate('lacunas')
    return () => { window.electronAPI?.derivation?.deactivate() }
  }, [])

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])

  useEffect(() => {
    lacunasEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lacunasText])

  const setProcessing = (v: boolean) => {
    setIsProcessingLocal(v)
    isProcessingRef.current = v
    onProcessingChange?.(v)
  }

  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate((update: AgentUpdate) => {
      if (!isProcessingRef.current) return
      if (update.type === 'AgentMessageChunk' && update.content) {
        if (stepRef.current === 'streaming') {
          lacunasAccRef.current += update.content
          setLacunasText((prev) => prev + update.content)
        }
      }
      if (update.type === 'TurnEnd') {
        setProcessing(false)
        if (stepRef.current === 'streaming') {
          setStep('done')
          stepRef.current = 'done'
          handleAutoSave(lacunasAccRef.current)
        }
      }
    })
    return () => unsub?.()
  }, [])

  const handleAutoSave = async (content: string) => {
    const api = window.electronAPI
    if (!api || !activeProject || !content.trim()) return
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}h${pad(now.getMinutes())}`
    const artifact = await api.artifactsCreate(
      activeProject.id,
      'lacuna',
      `Lacunas — ${stamp}`,
      content,
      activeProject.path,
    )
    setSavedArtifact(artifact)
    onArtifactSaved?.(artifact)
  }

  const buildStoriesContent = async (): Promise<string> => {
    const api = window.electronAPI
    if (!api || selectedArtifacts.length === 0) return ''
    const contents = await Promise.all(
      selectedArtifacts.map(async (a) => {
        const content = await api.artifactsRead(a.id).catch(() => null)
        return content ? `### ${a.title}\n\n${content}` : `### ${a.title}\n\n_(sem conteúdo)_`
      })
    )
    return contents.join('\n\n---\n\n')
  }

  const handleLevantar = async () => {
    const api = window.electronAPI
    if (!api || isProcessing) return
    setLacunasText('')
    setSavedArtifact(null)
    lacunasAccRef.current = ''
    setStep('streaming')
    stepRef.current = 'streaming'
    setProcessing(true)
    const storiesContent = await buildStoriesContent()
    const historias = storiesContent ? `\n\nHISTÓRIAS DE USUÁRIO:\n\n${storiesContent}` : ''
    api.sendPrompt(
      [
        `Levante as lacunas técnicas usando o processo da skill levantar-lacunas.`,
        `IMPORTANTE: gere APENAS o documento de lacunas completo — não pergunte onde salvar, não peça confirmação, não faça perguntas ao usuário. Pare assim que o documento estiver pronto.`,
        `Escreva toda a saída em português brasileiro com acentuação completa.`,
        historias,
      ].filter(Boolean).join('\n\n'),
    )
  }

  const handleCancel = () => {
    window.electronAPI?.cancelAcp()
    setProcessing(false)
    if (stepRef.current === 'streaming') {
      setStep('done')
      stepRef.current = 'done'
      if (lacunasAccRef.current.trim()) handleAutoSave(lacunasAccRef.current)
    }
  }

  const handleReset = async () => {
    if (isProcessing) window.electronAPI?.cancelAcp()
    await window.electronAPI?.derivation?.activate('lacunas')
    setStep('input')
    stepRef.current = 'input'
    setLacunasText('')
    setSavedArtifact(null)
    lacunasAccRef.current = ''
    setProcessing(false)
  }

  const isConnected = acpStatus === 'ready' || acpStatus === 'connected'

  return (
    <div className="deriv-panel">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="deriv-header">
        <div className="deriv-header-left">
          <span className="deriv-title">📐 Levantar Lacunas Técnicas</span>
        </div>
        <button className="deriv-reset-btn" onClick={handleReset}>↺ Reiniciar</button>
      </div>

      <div className="deriv-body">
        {/* ── Histórias selecionadas ────────────────────────── */}
        <div className="deriv-section">
          <div className="deriv-section-label">Histórias selecionadas</div>
          {selectedArtifacts.length === 0 ? (
            <div className="deriv-files-empty">
              Selecione histórias na barra lateral para usar como base do levantamento de lacunas.
            </div>
          ) : (
            <div className="deriv-files-list">
              {selectedArtifacts.map((a) => (
                <div key={a.id} className="deriv-file-chip">
                  <span className="deriv-file-icon">📄</span>
                  <span className="deriv-file-name">{a.title}</span>
                </div>
              ))}
            </div>
          )}

          {step === 'input' && (
            <div className="deriv-actions">
              <button className="deriv-btn-primary" onClick={handleLevantar} disabled={!isConnected || isProcessing}>
                Levantar Lacunas →
              </button>
            </div>
          )}
          {step === 'streaming' && (
            <div className="deriv-actions">
              <span className="deriv-status"><span className="spin-icon">⟳</span> Levantando lacunas…</span>
              <button className="deriv-btn-cancel" onClick={handleCancel}>✕ Cancelar</button>
            </div>
          )}
        </div>

        {/* ── Streaming ─────────────────────────────────────── */}
        {(step === 'streaming' || step === 'done') && (
          <div className="deriv-section">
            <div className="deriv-section-label">Lacunas Técnicas</div>
            <div className="deriv-output">
              <MarkdownRenderer content={lacunasText} />
              <div ref={lacunasEndRef} />
            </div>
          </div>
        )}

        {/* ── Salvo com sucesso ─────────────────────────────── */}
        {step === 'done' && savedArtifact && (
          <div className="deriv-section deriv-saved-notice">
            <span className="deriv-saved-icon">✅</span>
            <div>
              <strong>Lacunas salvas:</strong> <em>{savedArtifact.title}</em>
              <p>Clique no arquivo na barra lateral para responder as perguntas e derivar o Anexo Técnico.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
