import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

/** Retorna a lista de abas do workbook com nome e contagem de linhas */
export async function listSheets(caminho: string): Promise<{ name: string; rows: number }[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(caminho)
  const result: { name: string; rows: number }[] = []
  wb.eachSheet((ws) => result.push({ name: ws.name, rows: ws.rowCount }))
  return result
}

/** Porta do ler_planilha() Python — retorna texto estruturado para o agente */
export async function lerPlanilha(caminho: string, selectedSheets?: string[]): Promise<string> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(caminho)

  const partes: string[] = []

  wb.eachSheet((ws) => {
    if (selectedSheets && selectedSheets.length > 0 && !selectedSheets.includes(ws.name)) return
    partes.push(`\n## Aba: ${ws.name}\n`)
    ws.eachRow((row) => {
      const celulas: string[] = []
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const letra = colToLetter(col)
        const val = String(cell.value ?? '').trim().replace(/\n/g, ' ')
        if (val) celulas.push(`${letra}${row.number}=${val}`)
      })
      if (celulas.length) partes.push(celulas.join(' | '))
    })
  })

  return partes.join('\n')
}

/** Porta do exportar_historias_excel() Python — converte markdown de HU/HT para .xlsx estilizado */
export async function exportarExcel(conteudoMd: string, caminho: string): Promise<void> {
  const wb  = new ExcelJS.Workbook()
  const ws  = wb.addWorksheet('Historias')
  const cols = [
    'ID', 'Tipo', 'Macro Etapa', 'Produto', 'Titulo', 'Narrativa',
    'Prioridade', 'Complexidade', 'Integracoes', 'Integracoes Externas',
    'Pre-requisitos', 'Dependencias', 'Sistema Substituido',
    'Criterios de Aceite', 'Regras de Negocio',
  ]

  // Cabeçalho estilizado (azul Prodemge)
  const header = ws.addRow(cols)
  header.eachCell((cell) => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } }
    cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  ws.getRow(1).height = 28

  // Widths (15 colunas)
  const widths = [10, 6, 20, 20, 40, 60, 10, 12, 25, 25, 25, 20, 20, 50, 40]
  cols.forEach((_, i) => { ws.getColumn(i + 1).width = widths[i] })

  // Parse das seções ### HU/HT do markdown
  const blocos = conteudoMd.split(/(?=###\s+H[UT]\d+)/g)

  for (const bloco of blocos) {
    const idMatch = bloco.match(/###\s+(H[UT]\d+)\s*[-–]\s*(.+)/)
    if (!idMatch) continue

    const id     = idMatch[1].trim()
    const titulo = idMatch[2].trim()

    const campos: Record<string, string> = {}
    const tabelaRe = /\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/g
    let m: RegExpExecArray | null
    while ((m = tabelaRe.exec(bloco)) !== null) {
      campos[m[1].trim()] = m[2].trim()
    }

    // ── Narrativa (3 formatos) ─────────────────────────────────────
    let narrativa = ''

    // Padrão: **Narrativa:** seguida de blockquote (> ...)
    const padNarrMatch = bloco.match(/\*\*Narrativa:\*\*\s*([\s\S]*?)(?=\n\s*\||\n\s*\*\*|$)/)
    if (padNarrMatch) {
      narrativa = padNarrMatch[1].replace(/^>\s*/gm, '').trim()
    } else {
      // GFO+TJ: começa com **A fim de**
      const gfoNarrMatch = bloco.match(/(\*\*A fim de\*\*[\s\S]*?)(?=\n-{3,}|\n\*\*Resultados|\n\s*\||\n\*\*Observ|$)/i)
      if (gfoNarrMatch) {
        narrativa = gfoNarrMatch[1].trim()
      } else {
        // SIMADE: "Como [Persona (SSC: ...)], eu quero [...], para [...]."
        const simNarrMatch = bloco.match(/(Como\s[\s\S]*?para\s[^\n]+\.)/i)
        if (simNarrMatch) {
          narrativa = simNarrMatch[1].trim()
        }
      }
    }

    // ── Critérios de Aceite (3 formatos) ──────────────────────────
    let criterios = ''

    // Padrão: **Criterios de Aceite:**
    const padCritMatch = bloco.match(/\*\*Crit[eé]rios de Aceite:\*\*\s*([\s\S]*?)(?=\n\s*\*\*[A-Z]|\n\s*---|\n\s*#{1,3}\s|$)/)
    if (padCritMatch) {
      criterios = padCritMatch[1].trim()
    } else {
      // GFO+TJ: **Resultados esperados:** + **CA01:**...
      const gfoCritMatch = bloco.match(/\*\*Resultados esperados:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Observ|\n\s*\||\n\s*---|\n\s*#{1,3}\s|$)/i)
      if (gfoCritMatch) {
        criterios = gfoCritMatch[1].trim()
      } else {
        // SIMADE: CRITERIOS DE ACEITE (sem formatação markdown)
        const simCritMatch = bloco.match(/CRITERIOS?\s+DE\s+ACEITE\s*\n([\s\S]*?)(?=\n\s*HISTORICO|\n\s*\||\n\s*[A-Z]{4,}[\s\n]|$)/i)
        if (simCritMatch) {
          criterios = simCritMatch[1].trim()
        }
      }
    }

    // ── Regras de Negócio (Padrão) ─────────────────────────────────
    const rnMatch = bloco.match(/\*\*Regras de Neg[oó]cio:\*\*\s*([\s\S]*?)(?=\n\s*\*\*[A-Z]|\n\s*---|\n\s*#{1,3}\s|$)/)
    const regrasNegocio = rnMatch ? rnMatch[1].trim() : ''

    // ── Integracoes internas (fallback entre os 3 nomes de campo) ──
    const internas = campos['Integracoes Internas'] ?? campos['Integracoes GFO'] ?? campos['Integracoes SIMADE'] ?? '-'

    const row = ws.addRow([
      id,
      campos['Tipo'] ?? '',
      campos['Macro Etapa'] ?? '',
      campos['Produto'] ?? '',
      titulo,
      narrativa,
      campos['Prioridade'] ?? '',
      campos['Complexidade'] ?? '',
      internas,
      campos['Integracoes Externas'] ?? '',
      campos['Pre-requisitos'] ?? '',
      campos['Dependencias'] ?? '',
      campos['Sistema Substituido'] ?? '',
      criterios,
      regrasNegocio,
    ])

    row.eachCell((cell, col) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      if (col === 1) cell.font = { bold: true, color: { argb: 'FF2F5496' } }
    })

    const isHU = id.startsWith('HU')
    const idCell = row.getCell(1)
    idCell.fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: isHU ? 'FFE8F0FE' : 'FFEDE9F8' } }
  }

  // Freeze header + autofilter (15 colunas = A a O)
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: 'O1' }

  fs.mkdirSync(path.dirname(caminho), { recursive: true })
  await wb.xlsx.writeFile(caminho)
}

function colToLetter(col: number): string {
  let s = ''
  while (col > 0) {
    col--
    s = String.fromCharCode(65 + (col % 26)) + s
    col = Math.floor(col / 26)
  }
  return s
}
