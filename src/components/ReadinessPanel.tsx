import React, { useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Project, Artifact, AgentUpdate } from '../electron'

type Step = 'input' | 'streaming' | 'done'

// Extract veredito from the report text
function extractVeredito(text: string): string | null {
  const m = text.match(/\b(NOT READY|NEEDS REFINEMENT|READY COM RESSALVAS|READY)\b/)
  return m ? m[1] : null
}

function vereditoClass(v: string): string {
  if (v === 'READY') return 'vrd-ready'
  if (v === 'READY COM RESSALVAS') return 'vrd-ressalvas'
  if (v === 'NEEDS REFINEMENT') return 'vrd-refinement'
  if (v === 'NOT READY') return 'vrd-not-ready'
  return ''
}

interface Props {
  acpStatus: string
  onProcessingChange?: (v: boolean) => void
  activeProject?: Project | null
  onArtifactSaved?: (artifact: Artifact) => void
  selectedArtifactIds: Set<string>
  artifacts: Record<string, Artifact[]>
}

export default function ReadinessPanel({
  acpStatus,
  onProcessingChange,
  activeProject,
  onArtifactSaved,
  selectedArtifactIds,
  artifacts,
}: Props) {
  const [step, setStep]   = useState<Step>('input')
  const [result, setResult] = useState('')
  const [isProcessing, setIsProcessingLocal] = useState(false)

  const stepRef         = useRef<Step>('input')
  const isProcessingRef = useRef(false)
  const resultEndRef    = useRef<HTMLDivElement>(null)

  stepRef.current = step

  const allArtifacts       = Object.values(artifacts).flat()
  const selectedArtifacts  = allArtifacts.filter((a) => selectedArtifactIds.has(a.id))
  const storiesSelected    = selectedArtifacts.filter((a) => a.type === 'historia')
  const atSelected         = selectedArtifacts.filter((a) => a.type === 'anexo')

  useEffect(() => {
    window.electronAPI?.readiness?.activate('gfo')
    return () => { window.electronAPI?.readiness?.deactivate() }
  }, [])

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])

  useEffect(() => {
    resultEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [result])

  const setProcessing = (v: boolean) => {
    setIsProcessingLocal(v)
    isProcessingRef.current = v
    onProcessingChange?.(v)
  }

  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate((update: AgentUpdate) => {
      if (!isProcessingRef.current) return
      if (update.type === 'AgentMessageChunk' && update.content) {
        setResult((prev) => prev + update.content)
      }
      if (update.type === 'TurnEnd') {
        setProcessing(false)
        setStep('done')
        stepRef.current = 'done'
      }
    })
    return () => unsub?.()
  }, [])

  const buildContent = async (arts: Artifact[]): Promise<string> => {
    const api = window.electronAPI
    if (!api || arts.length === 0) return ''
    const contents = await Promise.all(
      arts.map(async (a) => {
        const content = await api.artifactsRead(a.id).catch(() => null)
        return content ? `### ${a.title}\n\n${content}` : `### ${a.title}\n\n_(sem conteúdo)_`
      })
    )
    return contents.join('\n\n---\n\n')
  }

  const handleValidar = async () => {
    const api = window.electronAPI
    if (!api || isProcessing) return
    setResult('')
    setStep('streaming')
    stepRef.current = 'streaming'
    setProcessing(true)

    const storiesContent = await buildContent(
      selectedArtifacts.length > 0 ? selectedArtifacts : [],
    )
    const atContent = await buildContent(atSelected)

    const parts = [
      `Valide as histórias de usuário abaixo usando o processo da skill validar-historia.`,
      `IMPORTANTE: gere APENAS o relatório completo de validação — não pergunte onde salvar, não peça confirmação, não faça perguntas ao usuário. Pare assim que o relatório estiver pronto.`,
      `Escreva toda a saída em português brasileiro com acentuação completa.`,
    ]
    if (storiesContent) parts.push(`HISTÓRIAS DE USUÁRIO:\n\n${storiesContent}`)
    if (atContent) parts.push(`ANEXO TÉCNICO (usar na ETAPA 4 — Coerência HT x AT):\n\n${atContent}`)

    api.sendPrompt(parts.join('\n\n'))
  }

  const handleSaveArtifact = async () => {
    const api = window.electronAPI
    if (!api || !activeProject || !result) return
    const date = new Date().toLocaleDateString('pt-BR')
    const title = `Validação DoR — ${date}`
    const artifact = await api.artifactsCreate(activeProject.id, 'validacao', title, result, activeProject.path)
    onArtifactSaved?.(artifact)
  }

  const handleExportMd = () => window.electronAPI?.readiness?.exportMd(result)

  const handleCancel = () => {
    window.electronAPI?.cancelAcp()
    setProcessing(false)
    setStep('done')
  }

  const handleReset = async () => {
    if (isProcessing) window.electronAPI?.cancelAcp()
    await window.electronAPI?.readiness?.activate('gfo')
    setStep('input')
    stepRef.current = 'input'
    setResult('')
    setProcessing(false)
  }

  const isConnected = acpStatus === 'ready' || acpStatus === 'connected'
  const veredito = step === 'done' ? extractVeredito(result) : null

  return (
    <div className="ready-panel">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="ready-header">
        <div className="ready-header-left">
          <span className="ready-title">✅ Validação Definition of Ready</span>
          {veredito && (
            <span className={`ready-veredito ${vereditoClass(veredito)}`}>{veredito}</span>
          )}
        </div>
        <button className="deriv-reset-btn" onClick={handleReset}>↺ Reiniciar</button>
      </div>

      <div className="deriv-body">
        {/* ── Arquivos selecionados ─────────────────────────── */}
        <div className="deriv-section">
          <div className="deriv-section-label">Histórias selecionadas</div>
          {selectedArtifacts.length === 0 ? (
            <div className="deriv-files-empty">
              Selecione histórias na barra lateral para validar. O assistente pode validar sem seleção, mas a qualidade melhora com as histórias específicas.
            </div>
          ) : (
            <div className="deriv-files-list">
              {storiesSelected.map((a) => (
                <div key={a.id} className="deriv-file-chip">
                  <span className="deriv-file-icon">📄</span>
                  <span className="deriv-file-name">{a.title}</span>
                </div>
              ))}
              {atSelected.map((a) => (
                <div key={a.id} className="deriv-file-chip ready-chip-at">
                  <span className="deriv-file-icon">📐</span>
                  <span className="deriv-file-name">{a.title}</span>
                  <span className="ready-at-badge">AT</span>
                </div>
              ))}
            </div>
          )}

          {atSelected.length > 0 && (
            <div className="ready-model-row">
              <span className="ready-at-hint">+ Coerência HT × AT ativada</span>
            </div>
          )}

          {step === 'input' && (
            <div className="deriv-actions">
              <button
                className="deriv-btn-primary"
                onClick={handleValidar}
                disabled={!isConnected || isProcessing}
              >
                Validar →
              </button>
            </div>
          )}

          {step === 'streaming' && (
            <div className="deriv-actions">
              <span className="deriv-status">
                <span className="spin-icon">⟳</span> Validando…
              </span>
              <button className="deriv-btn-cancel" onClick={handleCancel}>✕ Cancelar</button>
            </div>
          )}
        </div>

        {/* ── Relatório ────────────────────────────────────── */}
        {(step === 'streaming' || step === 'done') && (
          <div className="deriv-section">
            <div className="deriv-section-label">Relatório de Validação</div>
            <div className="deriv-output ready-output">
              <MarkdownRenderer content={result} />
              <div ref={resultEndRef} />
            </div>

            {step === 'done' && (
              <div className="deriv-actions">
                <button className="deriv-btn-secondary" onClick={handleExportMd}>
                  📥 Exportar .md
                </button>
                {activeProject && (
                  <button className="deriv-btn-primary" onClick={handleSaveArtifact}>
                    💾 Salvar como artefato
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
