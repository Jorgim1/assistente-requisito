import React, { useEffect, useRef, useState } from 'react'

interface FileAttachment {
  id: string
  name: string
  type: 'image' | 'text' | 'file'
  path?: string
  dataUrl?: string
  content?: string
}

const TEXT_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'md', 'txt',
  'json', 'yaml', 'yml', 'sh', 'css', 'html', 'htm', 'sql', 'c', 'cpp',
  'h', 'cs', 'rb', 'php', 'swift', 'kt', 'xml', 'toml', 'env',
])

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

interface Props {
  onSubmit: (displayText: string, promptText: string) => Promise<void> | void
  disabled: boolean
  acpStatus: string
  credits: string | null
  creditsLoading: boolean
  onRefreshCredits: () => void
  onCancel?: () => void
}

export default function InputBar({
  onSubmit,
  disabled,
  acpStatus,
  credits,
  creditsLoading,
  onRefreshCredits,
  onCancel,
}: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [mention, setMention] = useState<{
    filter: string
    atStart: number
    files: { name: string; path: string }[]
    selectedIdx: number
  } | null>(null)
  const cwdRef   = useRef<string>('')
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mention || !popupRef.current) return
    const el = popupRef.current.querySelector<HTMLElement>('.mention-option.selected')
    el?.scrollIntoView({ block: 'nearest' })
  }, [mention?.selectedIdx])

  useEffect(() => {
    window.electronAPI?.getCwd().then((c) => { cwdRef.current = c ?? '' })
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (mention) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMention((m) => m ? { ...m, selectedIdx: Math.min(m.selectedIdx + 1, m.files.length - 1) } : m)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMention((m) => m ? { ...m, selectedIdx: Math.max(m.selectedIdx - 1, 0) } : m)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        return
      }
      if (e.key === 'Enter' && mention.files.length > 0) {
        e.preventDefault()
        insertMention(mention.files[mention.selectedIdx])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) { doSubmit() }
    }
  }

  // O que aparece na bolha do chat: texto digitado + nome dos arquivos (sem conteúdo)
  const buildDisplay = () => {
    let text = value.trim()
    for (const att of attachments) {
      const icon = att.type === 'image' ? '🖼️' : '📄'
      text += `\n\n${icon} ${att.name}`
    }
    return text
  }

  // O que vai para a IA: texto + conteúdo completo dos arquivos
  const buildPrompt = () => {
    let text = value.trim()
    for (const att of attachments) {
      if (att.type === 'image') {
        text += `\n\n[Imagem: ${att.path ?? att.name}]`
      } else if (att.type === 'text' && att.content !== undefined) {
        const ext = getExt(att.name)
        text += `\n\n**${att.name}:**\n\`\`\`${ext}\n${att.content}\n\`\`\``
      } else {
        text += `\n\n[Arquivo: ${att.path ?? att.name}]`
      }
    }
    return text
  }

  const doSubmit = () => {
    const display = buildDisplay()
    if (display) {
      onSubmit(display, buildPrompt())
      setValue('')
      setAttachments([])
    }
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  const processFile = (file: File) => {
    const filePath = (file as any).path as string | undefined
    const ext = getExt(file.name)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setAttachments((prev) => [...prev, {
          id: `att-${Date.now()}-${Math.random()}`,
          name: file.name, type: 'image', path: filePath,
          dataUrl: e.target?.result as string,
        }])
      }
      reader.readAsDataURL(file)
    } else if (TEXT_EXTS.has(ext)) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setAttachments((prev) => [...prev, {
          id: `att-${Date.now()}-${Math.random()}`,
          name: file.name, type: 'text', path: filePath,
          content: e.target?.result as string,
        }])
      }
      reader.readAsText(file)
    } else {
      setAttachments((prev) => [...prev, {
        id: `att-${Date.now()}-${Math.random()}`,
        name: file.name, type: 'file', path: filePath,
      }])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    Array.from(e.dataTransfer.files).forEach(processFile)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }

  const handlePaste = (e: React.ClipboardEvent) => {
    const imageItems = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith('image/'))
    if (imageItems.length > 0) {
      e.preventDefault()
      imageItems.forEach((item) => { const f = item.getAsFile(); if (f) processFile(f) })
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    const el = ref.current
    if (!el) return
    const selectionStart = el.selectionStart ?? newValue.length
    const beforeCursor = newValue.slice(0, selectionStart)
    const match = /@([\w./]*)$/.exec(beforeCursor)

    if (match && cwdRef.current) {
      const filter = match[1]
      const atStart = match.index
      try {
        const files = await window.electronAPI!.searchFiles(cwdRef.current, filter)
        setMention({ filter, atStart, files: files.slice(0, 30), selectedIdx: 0 })
      } catch {
        setMention(null)
      }
    } else {
      setMention(null)
    }
  }

  const handlePickFiles = async () => {
    try {
      const paths = await window.electronAPI?.pickFiles()
      if (!paths || paths.length === 0) return
      for (const filePath of paths) {
        const name = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
        const ext = getExt(name)
        if (TEXT_EXTS.has(ext)) {
          const content = await window.electronAPI?.readFile(filePath)
          setAttachments((prev) => [...prev, {
            id: `att-${Date.now()}-${Math.random()}`,
            name, type: 'text', path: filePath, content: content ?? undefined,
          }])
        } else {
          setAttachments((prev) => [...prev, {
            id: `att-${Date.now()}-${Math.random()}`,
            name, type: 'file', path: filePath,
          }])
        }
      }
    } catch { /* usuário cancelou ou falha ao ler — nenhuma ação necessária */ }
  }

  const insertMention = (file: { name: string; path: string }) => {
    if (!mention) return
    const insertion = file.path
    const before = value.slice(0, mention.atStart)
    const after  = value.slice(mention.atStart + 1 + mention.filter.length)
    setValue(before + insertion + after)
    setMention(null)
    setTimeout(() => ref.current?.focus(), 0)
  }

  const creditsLabel = (() => {
    if (!window.electronAPI) return 'modo demo (sem Electron)'
    if (credits) {
      const line = credits.split('\n').find((l) => l.toLowerCase().includes('credit'))
      return line?.trim() ?? credits.trim()
    }
    if (acpStatus === 'connecting') return 'Conectando…'
    if (acpStatus === 'error')      return 'Sem conexão com kiro-cli'
    if (creditsLoading)             return 'Buscando créditos…'
    return 'Aguardando créditos…'
  })()

  return (
    <div
      className="input-area"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragging && (
        <div className="input-drop-overlay">Solte os arquivos aqui</div>
      )}

      {mention && mention.files.length > 0 && (
        <div className="mention-popup" ref={popupRef}>
          <div className="mention-popup-title">Arquivos · ↑↓ navegar · Enter selecionar</div>
          {mention.files.map((f, i) => (
            <button
              key={f.path}
              className={`mention-option${i === mention.selectedIdx ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(f) }}
            >
              <span className="mention-icon">📄</span>
              <span className="mention-name">{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="input-attachments">
          {attachments.map((att) => (
            <div key={att.id} className="att-chip">
              {att.type === 'image' && att.dataUrl ? (
                <img className="att-thumb" src={att.dataUrl} alt={att.name} />
              ) : (
                <span style={{ fontSize: 16 }}>{att.type === 'image' ? '🖼️' : '📄'}</span>
              )}
              <span className="att-name">{att.name}</span>
              <button
                className="att-remove"
                onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                title="Remover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="input-wrapper">
        {window.electronAPI && (
          <button
            className="attach-btn"
            onClick={handlePickFiles}
            title="Anexar arquivo"
            disabled={disabled}
            type="button"
          >
            📎
          </button>
        )}
        <textarea
          ref={ref}
          className="chat-textarea"
          placeholder={
            disabled
              ? 'Aguardando conexão com kiro-cli…'
              : 'Descreva o que precisa ou faça uma pergunta… (Enter para enviar)'
          }
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          rows={1}
          disabled={disabled}
        />
        {disabled && onCancel ? (
          <button
            className="cancel-btn"
            onClick={onCancel}
            title="Cancelar processamento (Esc)"
            type="button"
          >
            ⏹
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={() => { if (value.trim() && !disabled) { doSubmit() } }}
            disabled={disabled || !value.trim()}
          >
            ↑
          </button>
        )}
      </div>
      <div className="input-meta">
        <span>Enter para enviar · Shift+Enter para nova linha</span>
        <span className="input-meta-credits">
          <span>{creditsLabel}</span>
          {window.electronAPI && (
            <button
              className={`meta-refresh-btn${creditsLoading ? ' spinning' : ''}`}
              onClick={onRefreshCredits}
              disabled={creditsLoading}
              title="Atualizar créditos"
            >
              ↻
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
