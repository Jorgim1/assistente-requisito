import React, { useState } from 'react'

export type ExtractorModel = 'padrao' | 'gfo-tj' | 'simade'

const MODEL_LABELS: Record<ExtractorModel, string> = {
  'padrao':  'Padrão',
  'gfo-tj':  'GFO + TJ',
  'simade':  'SIMADE',
}

interface Props {
  model: ExtractorModel
  onModelChange: (m: ExtractorModel) => void
  excelFile: string | null
  excelContent: string | null
  availableSheets: {name: string, rows: number}[]
  selectedSheets: string[]
  hasOutput: boolean
  onPickExcel: () => void
  onSheetSelectionChange: (sheets: string[]) => void
  onSendPrompt: (text: string) => void
  onExportMd: () => void
  onExportXlsx: () => void
  disabled: boolean
}

export default function ExtractorBar({
  model, onModelChange,
  excelFile, excelContent,
  availableSheets, selectedSheets,
  hasOutput,
  onPickExcel, onSheetSelectionChange,
  onSendPrompt,
  onExportMd, onExportXlsx,
  disabled,
}: Props) {
  const [modelOpen, setModelOpen]     = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const fileName    = excelFile ? excelFile.replace(/\\/g, '/').split('/').pop() : null
  const contentLines = excelContent ? excelContent.split('\n').length : 0

  const toggleSheet = (name: string) => {
    const next = selectedSheets.includes(name)
      ? selectedSheets.filter((n) => n !== name)
      : [...selectedSheets, name]
    onSheetSelectionChange(next)
  }

  const handleExtrair = () => {
    let prompt = `Execute o processo completo de extração de histórias usando o modelo **${MODEL_LABELS[model]}**.\n\n`
    if (excelContent && fileName) {
      prompt += `**Planilha:** ${fileName}\n\n`
      prompt += `\`\`\`\n${excelContent}\n\`\`\`\n\n`
    }
    prompt += `Siga rigorosamente as regras de granularidade CRUD, classificação HU/HT e o formato de saída definido. `
    prompt += `Gere as histórias completas com narrativa, tabela de campos e critérios de aceite.`
    onSendPrompt(prompt)
  }

  const handleRefinar = () => {
    onSendPrompt(
      `Refine todas as histórias geradas usando a skill refinar-historias (modo refinamento em lote):\n\n` +
      `1. Para cada história, avalie o checklist INVEST:\n` +
      `   - Independente, Negociável, Valiosa, Estimável, Small (cabe numa sprint?), Testável\n` +
      `   - Marque cada critério como OK ou Alerta\n\n` +
      `2. Para histórias com qualquer Alerta:\n` +
      `   - Reescreva a narrativa se necessário (mantendo o modelo atual: Padrão/GFO+TJ/SIMADE)\n` +
      `   - Melhore os critérios de aceite para que sejam específicos e testáveis\n` +
      `   - Verifique se cobrem: caminho feliz, cenário de erro e caso de borda\n\n` +
      `3. Para todas as histórias, identifique gaps:\n` +
      `   - Cenários de erro faltando\n` +
      `   - Permissões/perfis não mencionados\n` +
      `   - Integrações implícitas não mapeadas\n` +
      `   - Regras de negócio implícitas (marcar como "VALIDAR COM PO")\n\n` +
      `Apresente: tabela INVEST resumida por história, versão refinada das histórias com Alerta, lista de gaps identificados.`
    )
  }

  return (
    <div className="extractor-bar">
      <div className="extractor-bar-top">
        <span className="extractor-bar-title">📋 Extrator de HU/HT</span>

        {/* Seletor de modelo */}
        <div className="extractor-model-wrap">
          <span className="extractor-label">Modelo:</span>
          <div className="extractor-model-selector">
            <button
              className="extractor-model-btn"
              onClick={() => setModelOpen((v) => !v)}
              disabled={disabled}
            >
              {MODEL_LABELS[model]} ▾
            </button>
            {modelOpen && (
              <div className="extractor-model-dropdown">
                {(Object.keys(MODEL_LABELS) as ExtractorModel[]).map((k) => (
                  <button
                    key={k}
                    className={`extractor-model-option${k === model ? ' selected' : ''}`}
                    onClick={() => { onModelChange(k); setModelOpen(false) }}
                  >
                    {MODEL_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seletor de arquivo Excel */}
        <button
          className={`extractor-file-btn${excelFile ? ' has-file' : ''}`}
          onClick={onPickExcel}
          disabled={disabled}
          title={excelFile ?? 'Selecionar planilha Excel'}
        >
          📎 {fileName ?? 'Planilha'}
        </button>

        {/* Badge de preview (só quando há conteúdo) */}
        {excelContent && (
          <button
            className={`extractor-preview-badge${previewOpen ? ' open' : ''}`}
            onClick={() => setPreviewOpen((v) => !v)}
            title={previewOpen ? 'Ocultar prévia' : 'Ver prévia do conteúdo lido'}
          >
            {contentLines} linhas {previewOpen ? '▴' : '▾'}
          </button>
        )}
      </div>

      {/* Seletor de abas (só quando há múltiplas abas) */}
      {availableSheets.length > 1 && (
        <div className="extractor-sheets">
          <span className="extractor-label">Abas:</span>
          {availableSheets.map((s) => (
            <button
              key={s.name}
              className={`extractor-sheet-btn${selectedSheets.includes(s.name) ? ' selected' : ''}`}
              onClick={() => toggleSheet(s.name)}
              disabled={disabled}
              title={`${s.rows} linhas`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Preview do conteúdo lido */}
      {previewOpen && excelContent && (
        <div className="extractor-preview">
          <pre className="extractor-preview-content">
            {excelContent.split('\n').slice(0, 25).join('\n')}
            {contentLines > 25 ? `\n… (+${contentLines - 25} linhas)` : ''}
          </pre>
        </div>
      )}

      {/* Botões de ação */}
      <div className="extractor-actions">
        <button
          className="ext-action-btn primary"
          onClick={handleExtrair}
          disabled={disabled}
          title={excelFile ? 'Extrair histórias da planilha selecionada' : 'Extrair histórias (cole o conteúdo no chat se não há planilha)'}
        >
          ⚡ Extrair Histórias
        </button>
        <button
          className="ext-action-btn"
          onClick={handleRefinar}
          disabled={disabled}
          title="Refinar histórias geradas com checklist INVEST"
        >
          ✦ Refinar com INVEST
        </button>
        <div className="ext-action-sep" />
        <button
          className="ext-action-btn export"
          onClick={onExportMd}
          disabled={disabled || !hasOutput}
          title={hasOutput ? 'Exportar histórias como arquivo Markdown' : 'Gere as histórias primeiro'}
        >
          Exp. .md
        </button>
        <button
          className="ext-action-btn export"
          onClick={onExportXlsx}
          disabled={disabled || !hasOutput}
          title={hasOutput ? 'Exportar histórias como planilha Excel' : 'Gere as histórias primeiro'}
        >
          Exp. .xlsx
        </button>
      </div>
    </div>
  )
}
