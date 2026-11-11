import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Message, ContentPart, Tool, ToolType } from '../types'
import type { AgentUpdate } from '../electron'
import { DEMO_MESSAGES } from '../data'
import LogPanel from './LogPanel'
import MarkdownRenderer from './MarkdownRenderer'
import InputBar from './InputBar'

function mapToolName(name: string): ToolType {
  const n = name.toLowerCase()
  if (n.includes('read')   || n.includes('file_read'))  return 'Read'
  if (n.includes('write')  || n.includes('file_write')) return 'Write'
  if (n.includes('edit')   || n.includes('str_replace')) return 'Edit'
  if (n.includes('bash')   || n.includes('exec') || n.includes('command')) return 'Bash'
  if (n.includes('grep')   || n.includes('search')) return 'Grep'
  return 'Read'
}

function formatArgs(args: unknown): string {
  if (typeof args === 'string') return args
  if (!args) return ''
  try {
    const obj = args as Record<string, unknown>
    const key = obj['path'] ?? obj['command'] ?? obj['pattern'] ?? obj['file']
    if (key) return String(key)
    return JSON.stringify(obj)
  } catch {
    return String(args)
  }
}


// ── Tool call ─────────────────────────────────────────────────────

function ToolCall({ tool }: { tool: Tool }) {
  return (
    <div className="tool-call">
      <span className={`tc-type-badge ${tool.type}`}>{tool.type}</span>
      <div className="tc-info">
        <div className="tc-args">{tool.args}</div>
        {tool.output && <div className="tc-output">⎿  {tool.output}</div>}
      </div>
      <span className={`tc-status ${tool.status}`}>
        {tool.status === 'running' && <span className="spin-icon">⟳</span>}
        {tool.status === 'done'    && '✓'}
        {tool.status === 'error'   && '✗'}
      </span>
    </div>
  )
}

// ── Message ───────────────────────────────────────────────────────

function ContentParts({ parts }: { parts: ContentPart[] }) {
  const text = parts.map((p) => p.content).join('\n')
  if (!text) return null
  return <MarkdownRenderer content={text} />
}

function ModelTag({ model }: { model?: string }) {
  if (!model) return null
  const label = model === 'auto' ? 'auto' : model.replace('claude-', '').replace('gpt-', 'GPT ')
  return <span className="msg-model-tag">{label}</span>
}

function MessageItem({ msg, streaming }: { msg: Message; streaming?: boolean }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    const text = msg.parts.map((p) => p.content).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (msg.role === 'user') {
    return (
      <div className="msg-user">
        <div className="msg-user-header">
          <span className="msg-user-role">Você</span>
        </div>
        <div className="msg-user-body">{msg.parts[0]?.content}</div>
      </div>
    )
  }

  return (
    <div className="msg-ai">
      <div className="msg-ai-header">
        <span className="msg-ai-icon">⚡</span>
        <span className="msg-ai-role">Assistente IA</span>
        <span className="msg-ai-badge">IA</span>
        <ModelTag model={msg.model} />
        {streaming && (
          <span className="msg-ai-generating">
            <span className="spin-icon">⟳</span> Gerando…
          </span>
        )}
        {!streaming && msg.parts.length > 0 && (
          <button
            className={`msg-copy-btn${copied ? ' copied' : ''}`}
            onClick={handleCopy}
            title="Copiar resposta"
          >
            {copied ? '✓' : '⎘'}
          </button>
        )}
      </div>

      {msg.tools && msg.tools.length > 0 && (
        <div className="tool-calls">
          {msg.tools.map((t, i) => <ToolCall key={`${t.type}-${i}`} tool={t} />)}
        </div>
      )}

      <div className="msg-body">
        {msg.parts.length > 0 ? (
          <>
            <ContentParts parts={msg.parts} />
            {streaming && <span className="cursor" />}
          </>
        ) : streaming ? (
          <p className="text-part text-muted">
            <span className="spin-icon">⟳</span> Processando…
          </p>
        ) : null}
      </div>

      {msg.credits !== undefined && !streaming && (
        <div className="msg-credits">💳 {msg.credits.toFixed(4)} créditos</div>
      )}
    </div>
  )
}

// ── Welcome state ─────────────────────────────────────────────────

function Welcome({ acpStatus }: { acpStatus: string }) {
  const messages: Record<string, React.ReactNode> = {
    connecting:   <><span className="spin-icon">⟳</span> Conectando ao kiro-cli…</>,
    error:        <>Não foi possível conectar ao kiro-cli. Verifique se está instalado e com sessão ativa.</>,
    disconnected: <>Assistente IA desconectado. Aguardando kiro-cli…</>,
  }

  return (
    <div className="welcome">
      <div className="welcome-icon">⚡</div>
      <div className="welcome-title">Assistente IA</div>
      <div className="welcome-sub">Assistente de desenvolvimento Prodemge via kiro-cli</div>
      {acpStatus !== 'ready' && (
        <div className={`welcome-status ${acpStatus}`}>
          {messages[acpStatus] ?? acpStatus}
        </div>
      )}
      {acpStatus === 'ready' && (
        <div className="welcome-hint">Pronto. Descreva o que precisa abaixo.</div>
      )}
    </div>
  )
}

// ── Live streaming state ──────────────────────────────────────────

interface LiveMsg {
  text: string
  tools: Tool[]
}

// ── ChatAreaRef (imperative API para envio de prompt via ref) ─────

export interface ChatAreaRef {
  send: (text: string) => void
}

// ── Chat area ─────────────────────────────────────────────────────

interface ChatAreaProps {
  selectedSessionId: string | null
  acpStatus: string
  logOpen?: boolean
  onToggleLog?: () => void
  credits?: string | null
  creditsLoading?: boolean
  onRefreshCredits?: () => void
  currentModel?: string
  onProcessingChange?: (v: boolean) => void
  onSessionCreated: (session: import('../electron').StoredSession) => void
  onSessionUpdated: (sessionId: string) => void
  onLastAiText?: (text: string) => void
  featureBar?: React.ReactNode
  featurePromptTransform?: (text: string) => string
  activeFeature?: string
}

const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(function ChatArea({
  selectedSessionId,
  acpStatus,
  logOpen,
  onToggleLog,
  credits,
  creditsLoading,
  onRefreshCredits,
  currentModel,
  onSessionCreated,
  onSessionUpdated,
  onLastAiText,
  onProcessingChange,
  featureBar,
  featurePromptTransform,
  activeFeature,
}, ref) {
  const inElectron = !!window.electronAPI

  const [messages, setMessages] = useState<Message[]>(inElectron ? [] : DEMO_MESSAGES)
  const [liveMsg,  setLiveMsg]  = useState<LiveMsg | null>(null)
  const [acpError, setAcpError] = useState<string | null>(null)

  const currentSessionId = useRef<string | null>(selectedSessionId)

  useEffect(() => {
    currentSessionId.current = selectedSessionId
    setLiveMsg(null)
    if (!selectedSessionId) {
      setMessages([])
      return
    }
    let cancelled = false
    window.electronAPI?.historyGet(selectedSessionId).then((session) => {
      if (cancelled || !session) return
      const msgs: Message[] = session.messages.map((m) => ({
        id:    m.id,
        role:  m.role,
        parts: [{ kind: 'text' as const, content: m.text }],
      }))
      setMessages(msgs)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [selectedSessionId])

  const toolIdx = useRef(new Map<string, number>())
  const bottomRef  = useRef<HTMLDivElement>(null)
  const isStreaming = liveMsg !== null

  useEffect(() => {
    onProcessingChange?.(isStreaming)
  // onProcessingChange é sempre setIsProcessing do App — ref estável do useState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveMsg?.text])

  // Persiste o kiro session ID no histórico assim que é capturado.
  // Isso permite restaurar o contexto da conversa ao trocar de sessão.
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onAcpSessionId) return
    return api.onAcpSessionId((kiroId) => {
      const sid = currentSessionId.current
      if (sid) api.historySetKiroSession(sid, kiroId)
    })
  }, [])

  // ── Agent listeners ──────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const u1 = api.onAcpStatus((status) => {
      if (status === 'disconnected' || status === 'error') setLiveMsg(null)
    })

    const u2 = api.onAcpError((msg) => {
      setAcpError(msg)
      setLiveMsg(null)
    })

    const u3 = api.onAcpUpdate((raw) => {
      const update = raw as AgentUpdate
      setAcpError(null)

      switch (update.type) {
        case 'AgentMessageChunk':
          setLiveMsg((prev) => ({
            text:  (prev?.text ?? '') + (update.content ?? ''),
            tools: prev?.tools ?? [],
          }))
          break

        case 'ToolCallStart':
          setLiveMsg((prev) => {
            const tools = [...(prev?.tools ?? [])]
            if (update.toolId) toolIdx.current.set(update.toolId, tools.length)
            tools.push({ type: mapToolName(update.toolName ?? ''), args: formatArgs(update.args), status: 'running' })
            return { text: prev?.text ?? '', tools }
          })
          break

        case 'ToolCallEnd':
          setLiveMsg((prev) => {
            if (!prev) return prev
            const tools = [...prev.tools]
            const i = update.toolId && toolIdx.current.has(update.toolId)
              ? toolIdx.current.get(update.toolId)!
              : tools.reduceRight((acc, t, idx) => (acc === -1 && t.status === 'running' ? idx : acc), -1)
            if (i >= 0) tools[i] = { ...tools[i], status: update.status === 'error' ? 'error' : 'done', output: update.output }
            return { ...prev, tools }
          })
          break

        case 'TurnEnd':
          setLiveMsg((prev) => {
            if (prev) {
              const finalized: Message = {
                id:    `a-${Date.now()}`,
                role:  'assistant',
                parts: prev.text ? [{ kind: 'text', content: prev.text }] : [],
                tools: prev.tools.length > 0 ? prev.tools : undefined,
                model: update.model,
                credits: update.credits,
              }
              setMessages((msgs) => [...msgs, finalized])
              if (prev.text) {
                onLastAiText?.(prev.text)
                const sid = currentSessionId.current
                if (sid) {
                  const msg = { id: `m-${Date.now()}`, role: 'assistant' as const, text: prev.text, timestamp: Date.now() }
                  window.electronAPI?.historyAppend(sid, msg)
                  onSessionUpdated(sid)
                }
              }
            }
            toolIdx.current.clear()
            return null
          })
          break
      }
    })

    return () => { u1(); u2(); u3() }
  }, [onSessionUpdated])

  // ── Envio de mensagem ────────────────────────────────────────
  // displayText → bolha do chat e histórico | promptText → o que a IA recebe (default = display)
  const handleSend = async (displayText: string, promptText?: string) => {
    const rawPrompt = promptText ?? displayText
    // featurePromptTransform só aplica na PRIMEIRA mensagem da conversa —
    // follow-ups vão como estão para não quebrar o contexto do diálogo.
    const isFirstMessage = !currentSessionId.current

    if (!inElectron) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user',      parts: [{ kind: 'text', content: displayText }] },
        { id: `a-${Date.now()}`, role: 'assistant', parts: [{ kind: 'text', content: '(modo demo — conecte via Electron)' }] },
      ])
      return
    }

    // Cria sessão se não houver nenhuma ativa (sem mudar key no App.tsx!)
    if (!currentSessionId.current) {
      const session = await window.electronAPI!.historyCreate(displayText, activeFeature)
      currentSessionId.current = session.id
      onSessionCreated(session)  // só atualiza sidebar, sem remount
    }

    const sid = currentSessionId.current!
    const userMsg = { id: `m-${Date.now()}`, role: 'user' as const, text: displayText, timestamp: Date.now() }
    window.electronAPI?.historyAppend(sid, userMsg)
    onSessionUpdated(sid)

    setMessages((prev) => [
      ...prev,
      { id: userMsg.id, role: 'user', parts: [{ kind: 'text', content: displayText }], promptContent: rawPrompt },
    ])
    setLiveMsg({ text: '', tools: [] })
    setAcpError(null)

    let finalPrompt: string
    if (isFirstMessage) {
      finalPrompt = featurePromptTransform ? featurePromptTransform(rawPrompt) : rawPrompt
    } else {
      // kiro-cli headless cria nova sessão a cada processo e não preserva mensagens do
      // usuário (arquivos, etc.) via --resume-id. Injetamos o histórico completo no prompt.
      const historyLines = messages.map((m) => {
        const content = m.role === 'user'
          ? (m.promptContent ?? m.parts.map((p) => p.content).join('\n'))
          : m.parts.map((p) => p.content).join('\n')
        return `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${content}`
      })
      finalPrompt = `[HISTÓRICO DESTA CONVERSA — use como contexto completo]\n\n${historyLines.join('\n\n---\n\n')}\n\n---\n\n[MENSAGEM ATUAL DO USUÁRIO]\n${rawPrompt}`
    }

    window.electronAPI?.sendPrompt(finalPrompt)
  }

  // Ref sempre atualizado para evitar closure stale no useImperativeHandle
  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend

  useImperativeHandle(ref, () => ({
    send: (text: string) => handleSendRef.current(text),
  }), [])

  // ── Live message como Message temporária ─────────────────────
  const liveAsMessage: Message | null = liveMsg
    ? {
        id:    'live',
        role:  'assistant',
        parts: liveMsg.text ? [{ kind: 'text', content: liveMsg.text }] : [],
        tools: liveMsg.tools.length > 0 ? liveMsg.tools : undefined,
        model: currentModel,
      }
    : null

  const showWelcome = messages.length === 0 && !liveMsg && inElectron

  return (
    <div className="chat-area">
      <div className="messages">
        {showWelcome && <Welcome acpStatus={acpStatus} />}

        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} />
        ))}

        {liveAsMessage && (
          <MessageItem msg={liveAsMessage} streaming />
        )}

        {acpError && (
          <div className="agent-error-banner">
            <strong>Erro:</strong> {acpError}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <LogPanel open={!!logOpen} onClose={onToggleLog ?? (() => {})} />

      {featureBar}

      <InputBar
        onSubmit={(display, prompt) => handleSend(display, prompt)}
        disabled={inElectron && (acpStatus !== 'ready' || isStreaming)}
        acpStatus={acpStatus}
        credits={credits ?? null}
        creditsLoading={creditsLoading ?? false}
        onRefreshCredits={onRefreshCredits ?? (() => {})}
        onCancel={isStreaming ? () => window.electronAPI?.cancelAcp() : undefined}
      />
    </div>
  )
})

export default ChatArea
