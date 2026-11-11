import React, { useCallback, useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Artifact, AgentUpdate } from '../electron'

interface LacunaItem {
  group: string
  id: string
  label: string
  answer: string
}

function parseLacunas(text: string): LacunaItem[] | null {
  const items: LacunaItem[] = []
  const lines = text.split('\n')
  let currentGroup = 'Geral'
  let counter = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const groupMatch = line.match(/^##\s+(.+)/)
    if (groupMatch) { currentGroup = groupMatch[1].trim(); continue }

    if (/>\s*\*\*Resposta[^*]*\*\*/.test(line)) {
      let label = ''
      let id = String(counter)
      // Extract existing answer from "**Resposta:** some text"
      const answerMatch = line.match(/>\s*\*\*Resposta[^*]*\*\*[:\s]*(.*)/)
      const rawAnswer = answerMatch ? answerMatch[1].trim() : ''
      const answer = (rawAnswer === '_(a preencher)_' || rawAnswer === '_(sem resposta)_' || rawAnswer === '') ? '' : rawAnswer

      for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
        const prev = lines[j].trim()
        if (!prev || prev.startsWith('>') || /^-{3,}$/.test(prev)) continue
        const h3Match = prev.match(/^#{2,4}\s+(.+)/)
        if (h3Match) { label = h3Match[1].trim(); break }
        const boldIdMatch = prev.match(/\*\*([A-Z]+-\d+)\s*[—–\-]+\s*(.+?)\*\*/)
        if (boldIdMatch) { id = boldIdMatch[1]; label = boldIdMatch[2].trim(); break }
        const boldMatch = prev.match(/^\*\*(.+?)\*\*$/)
        if (boldMatch) { label = boldMatch[1].trim(); break }
        if (!prev.startsWith('#')) { label = prev.replace(/\*\*/g, '').trim(); break }
      }

      if (label) {
        items.push({ group: currentGroup, id, label, answer })
        counter++
      }
    }
  }
  return items.length > 0 ? items : null
}

function rebuildWithAnswers(original: string, items: LacunaItem[]): string {
  let idx = 0
  return original.replace(/>\s*\*\*Resposta[^*]*\*\*[^\n]*/g, () => {
    const answer = items[idx++]?.answer?.trim() || '_(a preencher)_'
    return `> **Resposta:** ${answer}`
  })
}

type DerivStep = 'idle' | 'streaming' | 'done'

interface Props {
  artifact: Artifact
  acpStatus: string
  onProcessingChange?: (v: boolean) => void
  onArtifactSaved?: (artifact: Artifact) => void
  onDelete: () => void
}

export default function LacunaView({ artifact, acpStatus, onProcessingChange, onArtifactSaved, onDelete }: Props) {
  const [originalText, setOriginalText] = useState('')
  const [items, setItems] = useState<LacunaItem[] | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [derivStep, setDerivStep] = useState<DerivStep>('idle')
  const [anexoText, setAnexoText] = useState('')
  const [isProcessing, setIsProcessingLocal] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const isProcessingRef = useRef(false)
  const derivStepRef    = useRef<DerivStep>('idle')
  const anexoAccRef     = useRef('')
  const saveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anexoEndRef     = useRef<HTMLDivElement>(null)

  derivStepRef.current = derivStep

  const setProcessing = (v: boolean) => {
    setIsProcessingLocal(v)
    isProcessingRef.current = v
    onProcessingChange?.(v)
  }

  // Load content from file
  useEffect(() => {
    setLoadError(false)
    setSaveStatus('saved')
    setDerivStep('idle')
    setAnexoText('')
    anexoAccRef.current = ''
    window.electronAPI?.artifactsRead(artifact.id).then((content) => {
      if (!content) { setLoadError(true); return }
      setOriginalText(content)
      setItems(parseLacunas(content))
    }).catch(() => setLoadError(true))
  }, [artifact.id])

  useEffect(() => {
    anexoEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [anexoText])

  // ACP event handler
  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate((update: AgentUpdate) => {
      if (!isProcessingRef.current) return
      if (update.type === 'AgentMessageChunk' && update.content && derivStepRef.current === 'streaming') {
        anexoAccRef.current += update.content
        setAnexoText((prev) => prev + update.content)
      }
      if (update.type === 'TurnEnd') {
        setProcessing(false)
        if (derivStepRef.current === 'streaming') {
          setDerivStep('done')
          derivStepRef.current = 'done'
        }
      }
    })
    return () => unsub?.()
  }, [])

  // Save answers (debounced)
  const persistAnswers = useCallback((currentItems: LacunaItem[], original: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('unsaved')
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const rebuilt = rebuildWithAnswers(original, currentItems)
      await window.electronAPI?.artifactsUpdate(artifact.id, rebuilt).catch(() => {})
      setSaveStatus('saved')
    }, 800)
  }, [artifact.id])

  const updateAnswer = (id: string, value: string) => {
    setItems((prev) => {
      if (!prev) return prev
      const next = prev.map((item) => item.id === id ? { ...item, answer: value } : item)
      persistAnswers(next, originalText)
      return next
    })
  }

  const handleDerivar = async () => {
    const api = window.electronAPI
    if (!api || isProcessing) return
    // Save current state first
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (items) {
      const rebuilt = rebuildWithAnswers(originalText, items)
      await api.artifactsUpdate(artifact.id, rebuilt).catch(() => {})
      setSaveStatus('saved')
    }
    await api.derivation?.activate('anexo')
    setAnexoText('')
    anexoAccRef.current = ''
    setDerivStep('streaming')
    derivStepRef.current = 'streaming'
    setProcessing(true)

    const lacunasContent = items ? rebuildWithAnswers(originalText, items) : originalText
    api.sendPrompt(
      [
        `Derive o Anexo Técnico completo usando o processo da skill derivar-anexo.`,
        `IMPORTANTE: gere APENAS o documento do Anexo Técnico completo — não pergunte onde salvar, não peça confirmação, não faça perguntas ao usuário. Pare assim que o documento estiver pronto.`,
        `Escreva toda a saída em português brasileiro com acentuação completa.`,
        `LACUNAS (com respostas preenchidas):\n\n${lacunasContent}`,
      ].join('\n\n'),
    )
  }

  const handleCancelDeriv = () => {
    window.electronAPI?.cancelAcp()
    setProcessing(false)
    setDerivStep(anexoAccRef.current.trim() ? 'done' : 'idle')
    derivStepRef.current = anexoAccRef.current.trim() ? 'done' : 'idle'
  }

  const handleSaveAnexo = async () => {
    const api = window.electronAPI
    if (!api || !anexoText.trim()) return
    // We need the project — infer from artifact's projectId
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}h${pad(now.getMinutes())}`
    // artifactsCreate needs projectFolderPath — read from artifact.filePath parent's parent's parent
    const pathParts = artifact.filePath.replace(/\\/g, '/').split('/')
    // filePath: .../projectRoot/.assistente/lacunas/filename.md → projectRoot is 3 levels up
    const projectFolderPath = pathParts.slice(0, -3).join('/')
    const created = await api.artifactsCreate(
      artifact.projectId,
      'anexo',
      `Anexo Técnico — ${stamp}`,
      anexoText,
      projectFolderPath,
    )
    onArtifactSaved?.(created)
    // Deactivate derivation steering
    window.electronAPI?.derivation?.deactivate()
  }

  const isConnected = acpStatus === 'ready' || acpStatus === 'connected'

  // Group items by group name
  const groupedItems: { group: string; items: LacunaItem[] }[] = []
  if (items) {
    for (const item of items) {
      const existing = groupedItems.find((g) => g.group === item.group)
      if (existing) existing.items.push(item)
      else groupedItems.push({ group: item.group, items: [item] })
    }
  }

  const answeredCount = items?.filter((i) => i.answer.trim()).length ?? 0
  const totalCount    = items?.length ?? 0

  if (loadError) {
    return (
      <div className="lacuna-view">
        <div className="lacuna-error">Não foi possível carregar o arquivo de lacunas.</div>
      </div>
    )
  }

  if (!items && !originalText) {
    return <div className="lacuna-view"><div className="lacuna-loading">Carregando…</div></div>
  }

  return (
    <div className="lacuna-view">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="lacuna-header">
        <div className="lacuna-header-left">
          <span className="lacuna-title">❓ {artifact.title}</span>
          <span className="lacuna-progress">
            {answeredCount}/{totalCount} respondidas
          </span>
        </div>
        <div className="lacuna-header-right">
          <span className={`lacuna-save-status ${saveStatus}`}>
            {saveStatus === 'saving' ? '⟳ Salvando…' : saveStatus === 'unsaved' ? '● Não salvo' : '✓ Salvo'}
          </span>
          <button className="lacuna-delete-btn" onClick={onDelete} title="Excluir arquivo de lacunas">🗑</button>
        </div>
      </div>

      <div className="lacuna-body">
        {/* ── Formulário de respostas ─────────────────── */}
        {items ? (
          <div className="lacuna-form">
            {groupedItems.map(({ group, items: gItems }) => (
              <div key={group} className="lacuna-group">
                <div className="lacuna-group-title">{group}</div>
                {gItems.map((item) => (
                  <div key={item.id} className="lacuna-card">
                    <div className="lacuna-question-row">
                      <span className="lacuna-id">{item.id}</span>
                      <span className="lacuna-question">{item.label}</span>
                    </div>
                    <textarea
                      className="lacuna-answer"
                      placeholder="Resposta…"
                      value={item.answer}
                      onChange={(e) => updateAnswer(item.id, e.target.value)}
                      disabled={derivStep === 'streaming'}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // Fallback: arquivo sem o formato esperado de lacunas
          <div className="lacuna-raw">
            <div className="lacuna-group-title">Conteúdo do arquivo</div>
            <div className="lacuna-raw-content">
              <MarkdownRenderer content={originalText} />
            </div>
          </div>
        )}

        {/* ── Ação: Derivar ───────────────────────────── */}
        {derivStep === 'idle' && (
          <div className="lacuna-actions">
            <button
              className="lacuna-btn-derivar"
              onClick={handleDerivar}
              disabled={!isConnected || isProcessing}
              title={!isConnected ? 'Aguardando conexão…' : ''}
            >
              Derivar Anexo Técnico →
            </button>
          </div>
        )}

        {/* ── Streaming do Anexo Técnico ──────────────── */}
        {(derivStep === 'streaming' || derivStep === 'done') && (
          <div className="lacuna-anexo-section">
            <div className="lacuna-section-label">Anexo Técnico</div>
            <div className="deriv-output">
              <MarkdownRenderer content={anexoText} />
              <div ref={anexoEndRef} />
            </div>

            {derivStep === 'streaming' && (
              <div className="lacuna-actions">
                <span className="deriv-status"><span className="spin-icon">⟳</span> Gerando Anexo Técnico…</span>
                <button className="deriv-btn-cancel" onClick={handleCancelDeriv}>✕ Cancelar</button>
              </div>
            )}
            {derivStep === 'done' && (
              <div className="lacuna-actions">
                <button className="deriv-btn-secondary" onClick={() => window.electronAPI?.derivation?.exportMd(anexoText)}>
                  📥 Exportar .md
                </button>
                <button
                  className="lacuna-btn-derivar"
                  onClick={handleSaveAnexo}
                  disabled={!anexoText.trim()}
                >
                  💾 Salvar como Anexo Técnico
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
