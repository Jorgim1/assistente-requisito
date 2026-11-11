import React, { useEffect, useRef, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Project, Artifact, AgentUpdate } from '../electron'

type ExtractorModel = 'padrao' | 'gfo-tj' | 'simade'

const MODEL_OPTIONS: { value: ExtractorModel; label: string }[] = [
  { value: 'padrao',  label: 'Padrão'  },
  { value: 'gfo-tj',  label: 'GFO/TJ'  },
  { value: 'simade',  label: 'SIMADE'  },
]

interface Props {
  acpStatus: string
  currentModel?: string
  onProcessingChange?: (v: boolean) => void
  activeProject?: Project | null
  onArtifactSaved?: (artifact: Artifact) => void
}

export default function HistoriasPanel({
  acpStatus,
  onProcessingChange,
  activeProject,
  onArtifactSaved,
}: Props) {
  const [model, setModel]               = useState<ExtractorModel>('padrao')
  const [demandText, setDemandText]     = useState('')
  const [fileName, setFileName]         = useState<string | null>(null)
  const [result, setResult]             = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [savingArtifact, setSavingArtifact] = useState(false)

  const isExtractingRef = useRef(false)
  const resultEndRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI?.extrator?.activate(model)
    return () => { window.electronAPI?.extrator?.deactivate() }
  }, [])

  useEffect(() => { isExtractingRef.current = isExtracting }, [isExtracting])

  // Escuta streaming da IA
  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate((update: AgentUpdate) => {
      if (!isExtractingRef.current) return
      if (update.type === 'AgentMessageChunk' && update.content) {
        setResult((prev) => prev + update.content)
      } else if (update.type === 'TurnEnd') {
        setIsExtracting(false)
        isExtractingRef.current = false
        onProcessingChange?.(false)
      }
    })
    return () => unsub?.()
  }, [])

  useEffect(() => {
    resultEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [result])

  const handleModelChange = async (m: ExtractorModel) => {
    setModel(m)
    await window.electronAPI?.extrator?.activate(m)
  }

  const handlePickFile = async () => {
    const api = window.electronAPI
    if (!api) return
    const filePath = await api.extrator?.pickDemandFile()
    if (!filePath) return
    const name = filePath.split(/[/\\]/).pop() ?? filePath
    const ext  = name.split('.').pop()?.toLowerCase() ?? ''
    setFileName(name)
    let content: string | null = null
    if (ext === 'xlsx' || ext === 'xls') {
      content = await api.extrator?.readExcel(filePath) ?? null
    } else {
      content = await api.readFile(filePath)
    }
    if (content) setDemandText(content)
  }

  const handleClearFile = () => { setFileName(null); setDemandText('') }

  const handleExtract = async () => {
    if (!demandText.trim() || isExtracting || acpStatus !== 'ready') return
    await window.electronAPI?.extrator?.activate(model)
    setResult('')
    setIsExtracting(true)
    isExtractingRef.current = true
    onProcessingChange?.(true)
    const modelLabel = MODEL_OPTIONS.find((o) => o.value === model)?.label ?? model
    const prompt = [
      `Extraia as histórias de usuário do documento de demanda abaixo usando o modelo **${modelLabel}**.`,
      ``,
      `INSTRUÇÕES OBRIGATÓRIAS:`,
      `1. Siga rigorosamente as regras do arquivo extrator-regras.md e extrator-skill-extrair.md`,
      `2. Use o formato exato definido em extrator-formato.md`,
      `3. Escreva TODA a saída em português brasileiro COM acentuação completa (ã, ç, é, ê, â, etc.)`,
      `4. Aplique granularidade CRUD: cada ação atomica = 1 história separada`,
      `5. Numere sequencialmente: HU001, HU002... e HT001, HT002... (nunca reinicia entre etapas)`,
      `6. Mapeie dependências entre histórias conforme a lógica: Consultar depende de Cadastrar, etc.`,
      `7. Forneça 3 a 5 critérios de aceite específicos e testáveis por história`,
      `8. Ao final de cada macro etapa, inclua a tabela resumo`,
      ``,
      `DOCUMENTO DE DEMANDA:`,
      ``,
      demandText,
    ].join('\n')
    window.electronAPI?.sendPrompt(prompt)
  }

  const handleSaveArtifact = async () => {
    const api = window.electronAPI
    if (!api || !activeProject || savingArtifact || !result.trim()) return
    setSavingArtifact(true)
    try {
      const date  = new Date().toLocaleDateString('pt-BR')
      const base  = fileName ? fileName.replace(/\.[^.]+$/, '') : null
      const title = base ? `${base} — ${date}` : `Histórias — ${date}`
      const artifact = await api.artifactsCreate(
        activeProject.id, 'historia', title, result, activeProject.path,
      )
      onArtifactSaved?.(artifact)
    } finally {
      setSavingArtifact(false)
    }
  }

  const canExtract = acpStatus === 'ready' && demandText.trim().length > 0 && !isExtracting
  const canSave    = !!result.trim() && !isExtracting && !!activeProject

  return (
    <div className="historias-panel">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="historias-header">
        <div className="historias-header-left">
          <span className="historias-header-icon">📄</span>
          <div>
            <div className="historias-header-title">Extrair Histórias</div>
            <div className="historias-header-sub">Extração de histórias de usuário a partir de demandas</div>
          </div>
        </div>
        <div className="historias-header-right">
          <label className="historias-model-label">Modelo</label>
          <select
            className="historias-model-select"
            value={model}
            onChange={(e) => handleModelChange(e.target.value as ExtractorModel)}
            disabled={isExtracting}
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Corpo ─────────────────────────────────────────── */}
      <div className="historias-body">

        {/* ── Coluna esquerda: entrada ─────────────────────── */}
        <div className="historias-input-col">
          <div className="historias-section-label">DEMANDA</div>

          <textarea
            className="historias-textarea"
            placeholder="Cole aqui o texto da demanda, requisito, ou regra de negócio..."
            value={demandText}
            onChange={(e) => setDemandText(e.target.value)}
            disabled={isExtracting}
            spellCheck={false}
          />

          <div className="historias-file-row">
            <button className="historias-file-btn" onClick={handlePickFile} disabled={isExtracting}>
              📎 Carregar arquivo
            </button>
            {fileName ? (
              <>
                <span className="historias-file-name" title={fileName}>{fileName}</span>
                <button className="historias-file-clear" onClick={handleClearFile}>✕</button>
              </>
            ) : (
              <span className="historias-file-hint">.xlsx · .xls · .txt · .md</span>
            )}
          </div>

          <button className="historias-extract-btn" onClick={handleExtract} disabled={!canExtract}>
            {isExtracting
              ? <><span className="spin-icon">⟳</span> Extraindo histórias…</>
              : <>Extrair Histórias →</>}
          </button>
        </div>

        {/* ── Coluna direita: resultado ─────────────────────── */}
        <div className="historias-output-col">
          <div className="historias-section-label">
            RESULTADO
            {canSave && (
              <button
                className="historias-save-btn"
                onClick={handleSaveArtifact}
                disabled={savingArtifact}
              >
                {savingArtifact ? 'Salvando…' : '💾 Salvar como artefato'}
              </button>
            )}
          </div>

          <div className="historias-result">
            {!result && !isExtracting && (
              <div className="historias-output-empty">
                <div className="historias-output-empty-icon">✨</div>
                <p>O resultado da extração aparecerá aqui.<br />Use o chat à direita para fazer ajustes.</p>
              </div>
            )}
            {(result || isExtracting) && (
              <MarkdownRenderer content={result + (isExtracting ? '\n\n▌' : '')} />
            )}
            <div ref={resultEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
