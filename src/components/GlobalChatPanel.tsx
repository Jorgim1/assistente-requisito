import React, { useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Artifact, AgentUpdate, Project } from '../electron'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  system?: boolean  // mensagens do próprio app (perguntas de skill)
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

export default function GlobalChatPanel({
  acpStatus,
  width,
  onWidthChange,
  activeArtifact,
  selectedArtifacts,
  onProcessingChange,
  activeProject,
}: Props) {
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [inputText, setInputText]     = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [awaitingSkill, setAwaitingSkill] = useState(false)
  const [pendingMsg, setPendingMsg]       = useState('')
  const [activeSkill, setActiveSkill]     = useState<Skill | null>(null)

  const isProcessingRef = useRef(false)
  const chatEndRef      = useRef<HTMLDivElement>(null)

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])

  // Limpa o histórico ao trocar de projeto
  useEffect(() => {
    setMessages([])
    setAwaitingSkill(false)
    setPendingMsg('')
    setActiveSkill(null)
  }, [activeProject?.id])

  // Escuta streaming da IA
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
          if (last?.role === 'assistant' && !last.system) next[next.length - 1] = { ...last, streaming: false }
          return next
        })
        setIsProcessing(false)
        isProcessingRef.current = false
        onProcessingChange?.(false)
        // Desativa a steering após a resposta
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

    // Resposta à pergunta de skill
    if (awaitingSkill && pendingMsg) {
      const yes = /^(sim|s\b|yes|y\b|quero|ok\b|pode|ativa)/i.test(text)
      const no  = /^(não|nao|n\b|no\b|sem|direto|ignora)/i.test(text)
      if (yes || no) {
        setMessages((prev) => [...prev, { role: 'user', content: text }])
        setAwaitingSkill(false)
        const msg = pendingMsg
        const skill = yes ? (activeSkill ?? null) : null
        setPendingMsg('')
        if (!yes) setActiveSkill(null)
        await doSend(msg, skill)
        return
      }
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }])

    // Detecta skill se projeto ativo
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
      const delta = startX - ev.clientX
      const maxW = window.innerWidth - 200
      onWidthChange(Math.max(240, Math.min(maxW, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <>
      <div className="gchat-resize-handle" onMouseDown={onResizeMouseDown} />

      <div className="gchat-panel" style={{ width }}>
        <div className="gchat-header">
          <span className="gchat-header-title">CHAT</span>
          {contextArtifacts.length > 0 && (
            <div className="gchat-context-pills">
              {contextArtifacts.map((a) => (
                <span key={a.id} className="gchat-context-pill" title={a.title}>
                  📄 {a.title.length > 20 ? a.title.slice(0, 20) + '…' : a.title}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="gchat-messages">
          {messages.length === 0 && (
            <div className="gchat-empty">
              <p>
                {contextArtifacts.length > 0
                  ? `Contexto: ${contextArtifacts.length} artefato(s). Faça uma pergunta ou peça uma modificação.`
                  : 'Faça perguntas sobre o projeto ou selecione artefatos para usá-los como contexto.'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`gchat-msg gchat-msg-${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="gchat-bubble">{msg.content}</div>
              ) : (
                <div className={`gchat-ai${msg.system ? ' gchat-ai-system' : ''}`}>
                  <MarkdownRenderer content={msg.content + (msg.streaming ? '\n\n▌' : '')} />
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="gchat-input-row">
          <textarea
            className="gchat-input"
            placeholder={acpStatus === 'ready' ? 'Mensagem… (Enter para enviar)' : 'Aguardando conexão…'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing || acpStatus !== 'ready'}
            rows={3}
          />
          <button
            className="gchat-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing || acpStatus !== 'ready'}
          >
            {isProcessing ? <span className="spin-icon">⟳</span> : '↑'}
          </button>
        </div>
      </div>
    </>
  )
}
