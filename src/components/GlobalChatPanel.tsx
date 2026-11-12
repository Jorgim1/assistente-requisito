import React, { useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Artifact, AgentUpdate, Project } from '../electron'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  system?: boolean
  credits?: number
  model?: string
}

interface Props {
  acpStatus: string
  width: number
  onWidthChange: (w: number) => void
  activeArtifact: Artifact | null
  selectedArtifacts: Artifact[]
  onProcessingChange?: (v: boolean) => void
  activeProject?: Project | null
}

type Skill = 'extrator' | 'lacunas' | 'anexo' | 'validacao'

const SKILL_LABELS: Record<Skill, string> = {
  extrator: 'Extração de Histórias de Usuário',
  lacunas:  'Levantamento de Lacunas',
  anexo:    'Derivação de Anexo Técnico',
  validacao:'Validação DoR',
}

function detectSkill(text: string): Skill | null {
  const t = text.toLowerCase()
  if (/extrair|extrai|histórias|historias|\bhu\b|demanda/.test(t)) return 'extrator'
  if (/lacuna|levantar.{0,20}(questão|pergunta)|dúvida técnica/.test(t)) return 'lacunas'
  if (/anexo técnico|derivar.{0,15}anexo|gerar.{0,15}\bat\b/.test(t)) return 'anexo'
  if (/validar|validação|\bdor\b|readiness/.test(t)) return 'validacao'
  return null
}

function shortModel(model?: string): string {
  if (!model) return ''
  if (model.includes('opus'))   return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku'))  return 'Haiku'
  return model.split('-')[0]
}

export default function GlobalChatPanel({
  acpStatus,
  width,
  onWidthChange,
  activeArtifact,
  selectedArtifacts,
  onProcessingChange,
  activeProject,
}: Props) {
  const [messages, setMessages]           = useState<ChatMessage[]>([])
  const [inputText, setInputText]         = useState('')
  const [isProcessing, setIsProcessing]   = useState(false)
  const [awaitingSkill, setAwaitingSkill] = useState(false)
  const [pendingMsg, setPendingMsg]       = useState('')
  const [activeSkill, setActiveSkill]     = useState<Skill | null>(null)
  const [sessionCredits, setSessionCredits] = useState(0)

  const isProcessingRef = useRef(false)
  const chatEndRef      = useRef<HTMLDivElement>(null)

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])

  useEffect(() => {
    setMessages([])
    setAwaitingSkill(false)
    setPendingMsg('')
    setActiveSkill(null)
    setSessionCredits(0)
  }, [activeProject?.id])

  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate((update: AgentUpdate) => {
      if (!isProcessingRef.current) return
      if (update.type === 'AgentMessageChunk' && update.content) {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant' && !last.system) {
            next[next.length - 1] = { ...last, content: last.content + update.content }
          }
          return next
        })
      } else if (update.type === 'TurnEnd') {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant' && !last.system) {
            next[next.length - 1] = {
              ...last,
              streaming: false,
              credits: update.credits,
              model: update.model,
            }
          }
          return next
        })
        if (update.credits) setSessionCredits((c) => c + update.credits!)
        setIsProcessing(false)
        isProcessingRef.current = false
        onProcessingChange?.(false)
        setActiveSkill((skill) => {
          if (skill === 'extrator') window.electronAPI?.extrator?.deactivate()
          else if (skill === 'lacunas' || skill === 'anexo') window.electronAPI?.derivation?.deactivate()
          else if (skill === 'validacao') window.electronAPI?.readiness?.deactivate()
          return null
        })
      }
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const contextArtifacts = [
    ...(activeArtifact ? [activeArtifact] : []),
    ...selectedArtifacts.filter((a) => a.id !== activeArtifact?.id),
  ]

  const doSend = async (text: string, skill: Skill | null) => {
    const api = window.electronAPI
    const metaParts: string[] = []
    if (activeProject?.name) metaParts.push(`Projeto: ${activeProject.name}`)
    if (activeProject?.gitlabProjectPath) metaParts.push(`GitLab: ${activeProject.gitlabProjectPath}`)

    let contextBlock = ''
    if (api && contextArtifacts.length > 0) {
      const parts: string[] = []
      for (const art of contextArtifacts) {
        const c = await api.artifactsRead(art.id).catch(() => null)
        if (c) parts.push(`[${art.title}]\n${c}`)
      }
      if (parts.length > 0) contextBlock = `CONTEXTO:\n\n${parts.join('\n\n---\n\n')}\n\n---\n\n`
    }

    if (skill === 'extrator') await api?.extrator?.activate('padrao')
    else if (skill === 'lacunas') await api?.derivation?.activate('lacunas')
    else if (skill === 'anexo') await api?.derivation?.activate('anexo')
    else if (skill === 'validacao') await api?.readiness?.activate('padrao')

    setActiveSkill(skill)
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])
    setIsProcessing(true)
    isProcessingRef.current = true
    onProcessingChange?.(true)

    const metaBlock = metaParts.length > 0 ? metaParts.join('\n') + '\n\n' : ''
    api?.sendPrompt(metaBlock + contextBlock + text)
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || isProcessing || acpStatus !== 'ready') return
    setInputText('')

    if (awaitingSkill && pendingMsg) {
      const yes = /^(sim|s\b|yes|y\b|quero|ok\b|pode|ativa)/i.test(text)
      const no  = /^(não|nao|n\b|no\b|sem|direto|ignora)/i.test(text)
      if (yes || no) {
        setMessages((prev) => [...prev, { role: 'user', content: text }])
        setAwaitingSkill(false)
        const msg   = pendingMsg
        const skill = yes ? (activeSkill ?? null) : null
        setPendingMsg('')
        if (!yes) setActiveSkill(null)
        await doSend(msg, skill)
        return
      }
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }])

    if (activeProject) {
      const detected = detectSkill(text)
      if (detected) {
        const suggestion = `Identifiquei que você pode querer usar a skill de **${SKILL_LABELS[detected]}**. Deseja ativá-la para esta mensagem? _(responda sim ou não)_`
        setMessages((prev) => [...prev, { role: 'assistant', content: suggestion, system: true }])
        setPendingMsg(text)
        setActiveSkill(detected)
        setAwaitingSkill(true)
        return
      }
    }

    await doSend(text, null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      const maxW = window.innerWidth - 200
      onWidthChange(Math.max(240, Math.min(maxW, startW + (startX - ev.clientX))))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const isReady = acpStatus === 'ready'

  return (
    <>
      <div className="gchat-resize-handle" onMouseDown={onResizeMouseDown} />

      <div className="gchat-panel" style={{ width }}>

        {/* Header */}
        <div className="gchat-header">
          <div className="gchat-header-left">
            <span className="gchat-header-title">Chat</span>
            {activeProject && (
              <span className="gchat-header-project">{activeProject.name}</span>
            )}
          </div>
          <div className="gchat-header-right">
            {sessionCredits > 0 && (
              <span className="gchat-session-credits" title="Créditos gastos nesta sessão">
                💳 {sessionCredits.toFixed(2)}
              </span>
            )}
            <span className={`gchat-status-dot gchat-status-${acpStatus}`} title={acpStatus} />
          </div>
        </div>

        {/* Context pills */}
        {contextArtifacts.length > 0 && (
          <div className="gchat-context-bar">
            {contextArtifacts.map((a) => (
              <span key={a.id} className="gchat-context-pill" title={a.title}>
                📄 {a.title.length > 24 ? a.title.slice(0, 24) + '…' : a.title}
              </span>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="gchat-messages">
          {messages.length === 0 && (
            <div className="gchat-empty">
              <div className="gchat-empty-icon">✦</div>
              <p className="gchat-empty-title">Assistente de Requisitos</p>
              <p className="gchat-empty-hint">
                {contextArtifacts.length > 0
                  ? `${contextArtifacts.length} artefato(s) no contexto`
                  : 'Selecione artefatos ou faça uma pergunta'}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`gchat-msg gchat-msg-${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="gchat-bubble">{msg.content}</div>
              ) : msg.system ? (
                <div className="gchat-ai-system">
                  <span className="gchat-ai-system-icon">⚡</span>
                  <div className="gchat-ai-system-body">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                </div>
              ) : (
                <div className="gchat-ai-wrapper">
                  <div className="gchat-ai">
                    <MarkdownRenderer content={msg.content} />
                    {msg.streaming && <span className="gchat-cursor" />}
                  </div>
                  {!msg.streaming && (msg.credits != null || msg.model) && (
                    <div className="gchat-msg-meta">
                      {msg.model && (
                        <span className="gchat-msg-model">{shortModel(msg.model)}</span>
                      )}
                      {msg.credits != null && msg.credits > 0 && (
                        <span className="gchat-msg-credits">💳 {msg.credits.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="gchat-input-area">
          <textarea
            className="gchat-input"
            placeholder={isReady ? 'Mensagem… (Enter para enviar, Shift+Enter para quebrar linha)' : 'Aguardando conexão…'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing || !isReady}
            rows={2}
          />
          <button
            className="gchat-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing || !isReady}
            title="Enviar (Enter)"
          >
            {isProcessing
              ? <span className="gchat-typing"><span /><span /><span /></span>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            }
          </button>
        </div>
      </div>
    </>
  )
}
