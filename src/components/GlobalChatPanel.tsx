import React, { useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Artifact, AgentUpdate, Project } from '../electron'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
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

export default function GlobalChatPanel({
  acpStatus,
  width,
  onWidthChange,
  activeArtifact,
  selectedArtifacts,
  onProcessingChange,
  activeProject,
}: Props) {
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const isProcessingRef = useRef(false)
  const chatEndRef      = useRef<HTMLDivElement>(null)

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])

  // Escuta streaming da IA
  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate((update: AgentUpdate) => {
      if (!isProcessingRef.current) return
      if (update.type === 'AgentMessageChunk' && update.content) {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + update.content }
          }
          return next
        })
      } else if (update.type === 'TurnEnd') {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false }
          return next
        })
        setIsProcessing(false)
        isProcessingRef.current = false
        onProcessingChange?.(false)
      }
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Monta os artifacts que estão no contexto (ativo + selecionados)
  const contextArtifacts = [
    ...(activeArtifact ? [activeArtifact] : []),
    ...selectedArtifacts.filter((a) => a.id !== activeArtifact?.id),
  ]

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || isProcessing || acpStatus !== 'ready') return
    setInputText('')

    // Carrega conteúdo dos artefatos de contexto
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
      if (parts.length > 0) {
        contextBlock = `CONTEXTO:\n\n${parts.join('\n\n---\n\n')}\n\n---\n\n`
      }
    }

    const metaBlock = metaParts.length > 0 ? metaParts.join('\n') + '\n\n' : ''
    const prompt = metaBlock + contextBlock + text
    setMessages((prev) => [
      ...prev,
      { role: 'user',      content: text },
      { role: 'assistant', content: '', streaming: true },
    ])
    setIsProcessing(true)
    isProcessingRef.current = true
    onProcessingChange?.(true)
    api?.sendPrompt(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Handle de resize (arrasta p/ esquerda/direita)
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      onWidthChange(Math.max(240, Math.min(640, startW + delta)))
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
                <div className="gchat-ai">
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
