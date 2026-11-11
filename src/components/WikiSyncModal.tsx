import React, { useEffect, useRef, useState } from 'react'
import type { WikiPage, Artifact, AgentUpdate } from '../electron'

interface Props {
  gitlabProjectPath: string
  projectId: string
  projectFolderPath: string
  localArtifacts: Artifact[]
  onClose: () => void
  onArtifactSaved: (artifact: Artifact) => void
}

type SyncStatus = 'loading' | 'synced' | 'diverged' | 'local-only' | 'wiki-only'

interface SyncItem {
  title: string
  status: SyncStatus
  slug?: string           // slug na wiki
  artifact?: Artifact     // artefato local correspondente
  localContent?: string
  wikiContent?: string
  isHome?: boolean
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  loading:      '…',
  synced:       '✅ Sincronizado',
  diverged:     '⚠ Desatualizado',
  'local-only': '🖥 Apenas local',
  'wiki-only':  '☁ Apenas na wiki',
}
const STATUS_CLS: Record<SyncStatus, string> = {
  loading:      'sync-status-loading',
  synced:       'sync-status-synced',
  diverged:     'sync-status-diverged',
  'local-only': 'sync-status-local',
  'wiki-only':  'sync-status-wiki',
}

// Extrai blocos <PAGINA slug="...">...</PAGINA> da resposta do AI
function parseAiPages(text: string): Map<string, string> {
  const result = new Map<string, string>()
  const re = /<PAGINA[^>]+slug="([^"]+)"[^>]*>([\s\S]*?)<\/PAGINA>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    result.set(m[1].trim(), m[2].trim())
  }
  return result
}

export default function WikiSyncModal({
  gitlabProjectPath,
  projectId,
  projectFolderPath,
  localArtifacts,
  onClose,
  onArtifactSaved,
}: Props) {
  const [items, setItems]       = useState<SyncItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState<string | null>(null)   // título em operação individual
  const [batchBusy, setBatchBusy] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  const aiAccRef      = useRef('')
  const pushTargetRef = useRef<SyncItem | null>(null)   // push individual
  const batchModeRef  = useRef(false)                   // push em lote

  // Listener de streaming para operações de push via AI
  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate(async (update: AgentUpdate) => {
      const isBatch    = batchModeRef.current
      const individual = pushTargetRef.current
      if (!isBatch && !individual) return

      if (update.type === 'AgentMessageChunk' && update.content) {
        aiAccRef.current += update.content
      } else if (update.type === 'TurnEnd') {
        const rawText = aiAccRef.current.trim()
        aiAccRef.current = ''
        batchModeRef.current  = false
        pushTargetRef.current = null

        await saveAiResult(rawText, isBatch, individual)
      }
    })
    return () => unsub?.()
  }, [gitlabProjectPath, items])

  async function saveAiResult(rawText: string, isBatch: boolean, individual: SyncItem | null) {
    const api = window.electronAPI!
    setAiStatus('Salvando na wiki…')
    try {
      if (isBatch) {
        // Lote: extrai todas as páginas do bloco <PAGINA>
        const pages = parseAiPages(rawText)
        const updates: Promise<void>[] = []

        for (const [slug, content] of pages.entries()) {
          const item = items.find((i) => i.slug === slug || slugify(i.title) === slug)
          if (slug === 'home' || (item?.isHome)) {
            updates.push(
              api.gitlab.wikiUpdate(gitlabProjectPath, 'home', content, 'home').then(() => {
                setItems((prev) => prev.map((i) =>
                  i.isHome ? { ...i, status: 'synced', wikiContent: content } : i
                ))
              })
            )
          } else if (item) {
            const fn = item.slug
              ? api.gitlab.wikiUpdate(gitlabProjectPath, item.slug, content, item.title)
              : api.gitlab.wikiCreate(gitlabProjectPath, item.title, content)
            updates.push(fn.then(() => {
              setItems((prev) => prev.map((i) =>
                i.title === item.title ? { ...i, status: 'synced', wikiContent: content } : i
              ))
            }))
          }
        }
        await Promise.all(updates)
      } else if (individual) {
        // Individual: extrai <PAGINA> da história e da home
        const pages = parseAiPages(rawText)
        // fallback: se AI não usou o formato, tudo vai para a história
        const storySlug = individual.slug ?? slugify(individual.title)
        const storyContent = pages.get(storySlug) ?? pages.get(slugify(individual.title)) ?? rawText
        const homeContent  = pages.get('home') ?? null

        if (individual.slug) {
          await api.gitlab.wikiUpdate(gitlabProjectPath, individual.slug, storyContent, individual.title)
        } else {
          await api.gitlab.wikiCreate(gitlabProjectPath, individual.title, storyContent)
        }
        if (homeContent) {
          const homeItem = items.find((i) => i.isHome)
          if (homeItem?.slug) await api.gitlab.wikiUpdate(gitlabProjectPath, homeItem.slug, homeContent, homeItem.title)
        }

        setItems((prev) => prev.map((i) =>
          i.title === individual.title ? { ...i, status: 'synced', wikiContent: storyContent } : i
        ))
      }
    } catch (err) {
      console.error('Erro ao salvar na wiki:', err)
      setAiStatus('Erro ao salvar. Verifique o log.')
      return
    } finally {
      setBusy(null)
      setBatchBusy(false)
      setAiStatus(null)
    }
  }

  useEffect(() => { load() }, [gitlabProjectPath])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const api = window.electronAPI!
      const wikiPages: WikiPage[] = await api.gitlab.wikiList(gitlabProjectPath)

      const wikiBySlug = new Map<string, WikiPage>()
      for (const p of wikiPages) {
        wikiBySlug.set(p.slug,         p)
        wikiBySlug.set(slugify(p.title), p)
      }

      const localBySlug = new Map<string, Artifact>()
      for (const a of localArtifacts) {
        localBySlug.set(slugify(a.title), a)
      }

      const allKeys = new Set([...wikiBySlug.keys(), ...localBySlug.keys()])
      const draft: SyncItem[] = []
      const seen = new Set<string>()

      for (const key of allKeys) {
        const wiki  = wikiBySlug.get(key)
        const local = localBySlug.get(key)
        const title = local?.title ?? wiki?.title ?? key
        if (seen.has(title)) continue
        seen.add(title)

        const isHome = /^home$/i.test(wiki?.slug ?? '') || /^home$/i.test(title)

        if (wiki && local) {
          draft.push({ title, slug: wiki.slug, artifact: local, status: 'loading', isHome })
        } else if (local) {
          draft.push({ title, artifact: local, status: 'local-only', isHome })
        } else if (wiki) {
          draft.push({ title, slug: wiki.slug, status: 'wiki-only', isHome })
        }
      }

      setItems(draft)
      setLoading(false)

      // Compara conteúdo dos itens com correspondência em ambos os lados
      for (const item of draft.filter((i) => i.status === 'loading')) {
        const [wikiPage, localContent] = await Promise.all([
          api.gitlab.wikiGet(gitlabProjectPath, item.slug!),
          item.artifact ? api.artifactsRead(item.artifact.id).catch(() => '') : Promise.resolve(''),
        ])
        const wikiContent = wikiPage?.content ?? ''
        const status: SyncStatus = localContent.trim() === wikiContent.trim() ? 'synced' : 'diverged'
        setItems((prev) =>
          prev.map((i) => i.title === item.title ? { ...i, status, localContent, wikiContent } : i)
        )
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Erro ao carregar wiki')
      setLoading(false)
    }
  }

  // Monta prompt com referência de padrão + conteúdo local
  async function buildPrompt(targets: SyncItem[], allItems: SyncItem[]): Promise<string> {
    const api = window.electronAPI!

    // Busca conteúdos locais dos targets
    const targetBlocks: string[] = []
    for (const item of targets) {
      const content = item.localContent
        ?? (item.artifact ? await api.artifactsRead(item.artifact.id).catch(() => '') : '')
      const slug = item.slug ?? slugify(item.title)
      targetBlocks.push(`<LOCAL titulo="${item.title}" slug="${slug}">\n${content}\n</LOCAL>`)
    }

    // Busca Home e páginas de referência (sincronizadas)
    const homeItem = allItems.find((i) => i.isHome)
    let homeBlock = ''
    if (homeItem?.slug) {
      const full = await api.gitlab.wikiGet(gitlabProjectPath, homeItem.slug).catch(() => null)
      if (full?.content) homeBlock = `<HOME slug="${homeItem.slug}">\n${full.content}\n</HOME>`
    }

    const refItem = allItems.find((i) => i.status === 'synced' && i.slug && !i.isHome)
    let refBlock = ''
    if (refItem?.slug) {
      const full = await api.gitlab.wikiGet(gitlabProjectPath, refItem.slug).catch(() => null)
      if (full?.content) refBlock = `<REFERENCIA titulo="${refItem.title}">\n${full.content}\n</REFERENCIA>`
    }

    return `Você vai publicar histórias na wiki do GitLab do projeto "${gitlabProjectPath}".

${refBlock ? `EXEMPLO DE FORMATAÇÃO JÁ USADO NA WIKI:\n${refBlock}\n` : ''}
${homeBlock ? `HOME PAGE ATUAL DA WIKI (índice de histórias):\n${homeBlock}\n` : ''}

CONTEÚDO LOCAL A PUBLICAR:
${targetBlocks.join('\n\n')}

TAREFAS:
1. Formate cada história seguindo o padrão das páginas existentes na wiki.
2. Atualize a Home page para incluir links para todas as histórias publicadas (se ainda não estiver).

Responda APENAS com os blocos abaixo — um por página a salvar — sem nenhum texto adicional:

<PAGINA slug="[slug-da-pagina]">
[conteúdo formatado]
</PAGINA>

<PAGINA slug="home">
[home page atualizada]
</PAGINA>`
  }

  async function handlePush(item: SyncItem) {
    setBusy(item.title)
    setAiStatus('Preparando…')
    const prompt = await buildPrompt([item], items)
    setAiStatus('Formatando com IA…')
    pushTargetRef.current = item
    aiAccRef.current = ''
    window.electronAPI?.sendPrompt(prompt)
  }

  async function handleBatchPush() {
    const targets = items.filter((i) => i.status === 'local-only' || i.status === 'diverged')
    if (targets.length === 0) return
    setBatchBusy(true)
    setAiStatus('Preparando…')
    const prompt = await buildPrompt(targets, items)
    setAiStatus('Formatando com IA…')
    batchModeRef.current = true
    aiAccRef.current = ''
    window.electronAPI?.sendPrompt(prompt)
  }

  async function handlePull(item: SyncItem) {
    setBusy(item.title)
    try {
      const api  = window.electronAPI!
      const full = await api.gitlab.wikiGet(gitlabProjectPath, item.slug!)
      if (!full?.content) return

      if (item.artifact) {
        await api.artifactsUpdate(item.artifact.id, full.content)
        onArtifactSaved({ ...item.artifact })
      } else {
        const artifact = await api.artifactsCreate(projectId, 'historia', item.title, full.content, projectFolderPath)
        onArtifactSaved(artifact)
      }
      setItems((prev) =>
        prev.map((i) =>
          i.title === item.title
            ? { ...i, status: 'synced', localContent: full.content, wikiContent: full.content }
            : i
        )
      )
    } catch (err) {
      console.error('Erro ao importar da wiki:', err)
    } finally {
      setBusy(null)
    }
  }

  const isBusy = busy !== null || batchBusy
  const pendingCount = items.filter((i) => i.status === 'local-only' || i.status === 'diverged').length

  return (
    <div className="modal-overlay" onClick={isBusy ? undefined : onClose}>
      <div className="modal-card wiki-sync-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Sincronizar com Wiki</div>
        <p className="wiki-modal-project">{gitlabProjectPath}</p>

        {aiStatus && (
          <div className="wiki-sync-ai-status">
            <span className="spin-icon">⟳</span> {aiStatus}
          </div>
        )}

        {loading && <p className="wiki-modal-status">Carregando e comparando…</p>}
        {error   && <p className="wiki-modal-error">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="wiki-modal-status">Nenhum artefato local nem página na wiki.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            {pendingCount > 1 && (
              <div className="wiki-sync-batch-bar">
                <span>{pendingCount} {pendingCount === 1 ? 'item' : 'itens'} para enviar</span>
                <button
                  className="wiki-sync-btn wiki-sync-btn-push"
                  disabled={isBusy}
                  onClick={handleBatchPush}
                >
                  ⬆ Publicar tudo com IA
                </button>
              </div>
            )}

            <div className="wiki-sync-list">
              <div className="wiki-sync-header">
                <span>Título</span>
                <span>Status</span>
                <span>Ações</span>
              </div>
              {items.map((item) => (
                <div key={item.title} className={`wiki-sync-row${item.isHome ? ' wiki-sync-row-home' : ''}`}>
                  <span className="wiki-sync-title" title={item.title}>
                    {item.isHome && '🏠 '}
                    {item.title.length > 34 ? item.title.slice(0, 34) + '…' : item.title}
                  </span>
                  <span className={`wiki-sync-status ${STATUS_CLS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span className="wiki-sync-actions">
                    {(item.status === 'local-only' || item.status === 'diverged') && !item.isHome && (
                      <button
                        className="wiki-sync-btn wiki-sync-btn-push"
                        disabled={isBusy}
                        onClick={() => handlePush(item)}
                        title="Formatar com IA e enviar para wiki"
                      >
                        {busy === item.title ? '…' : '⬆ Enviar'}
                      </button>
                    )}
                    {(item.status === 'wiki-only' || item.status === 'diverged') && (
                      <button
                        className="wiki-sync-btn wiki-sync-btn-pull"
                        disabled={isBusy}
                        onClick={() => handlePull(item)}
                        title="Importar da wiki"
                      >
                        {busy === item.title && !aiStatus ? '…' : '⬇ Importar'}
                      </button>
                    )}
                    {item.status === 'synced' && <span className="wiki-sync-ok">—</span>}
                    {item.status === 'loading' && <span className="wiki-sync-ok">…</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={onClose} disabled={isBusy}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
