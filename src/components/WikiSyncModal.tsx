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
  slug?: string
  artifact?: Artifact
  localContent?: string
  wikiContent?: string
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
  const [busy, setBusy]         = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  // Acumula resposta do AI via streaming
  const aiAccRef      = useRef('')
  const pushTargetRef = useRef<SyncItem | null>(null)
  const homePage      = useRef<WikiPage | null>(null)

  // Listener de streaming para o push via AI
  useEffect(() => {
    const unsub = window.electronAPI?.onAcpUpdate(async (update: AgentUpdate) => {
      if (!pushTargetRef.current) return

      if (update.type === 'AgentMessageChunk' && update.content) {
        aiAccRef.current += update.content
      } else if (update.type === 'TurnEnd') {
        const item    = pushTargetRef.current
        const rawText = aiAccRef.current.trim()
        pushTargetRef.current = null
        aiAccRef.current = ''

        const api = window.electronAPI!

        // Extrai blocos <HISTORIA> e <HOME> da resposta
        const storyMatch = rawText.match(/<HISTORIA>([\s\S]*?)<\/HISTORIA>/i)
        const homeMatch  = rawText.match(/<HOME>([\s\S]*?)<\/HOME>/i)

        const storyContent = storyMatch ? storyMatch[1].trim() : rawText
        const homeContent  = homeMatch  ? homeMatch[1].trim()  : null

        try {
          setAiStatus('Salvando na wiki…')

          // 1. Cria ou atualiza a página da história
          if (item.slug) {
            await api.gitlab.wikiUpdate(gitlabProjectPath, item.slug, storyContent, item.title)
          } else {
            await api.gitlab.wikiCreate(gitlabProjectPath, item.title, storyContent)
          }

          // 2. Atualiza a Home se o AI retornou conteúdo novo para ela
          if (homeContent && homePage.current) {
            await api.gitlab.wikiUpdate(gitlabProjectPath, homePage.current.slug, homeContent, homePage.current.title)
          }

          setItems((prev) =>
            prev.map((i) =>
              i.title === item.title
                ? { ...i, status: 'synced', wikiContent: storyContent }
                : i
            )
          )
        } catch (err) {
          console.error('Erro ao salvar na wiki:', err)
          setAiStatus('Erro ao salvar na wiki.')
        } finally {
          setBusy(null)
          setAiStatus(null)
        }
      }
    })
    return () => unsub?.()
  }, [gitlabProjectPath])

  useEffect(() => { load() }, [gitlabProjectPath])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const api = window.electronAPI!
      const wikiPages: WikiPage[] = await api.gitlab.wikiList(gitlabProjectPath)

      // Guarda referência da home para o push
      const home = wikiPages.find((p) => /^home$/i.test(p.slug) || /^home$/i.test(p.title))
      if (home) homePage.current = home

      const wikiBySlug = new Map<string, WikiPage>()
      for (const p of wikiPages) {
        if (/^home$/i.test(p.slug)) continue  // exclui a Home da lista de sync
        wikiBySlug.set(slugify(p.title), p)
        wikiBySlug.set(slugify(p.slug),  p)
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

        if (wiki && local) {
          draft.push({ title, slug: wiki.slug, artifact: local, status: 'loading' })
        } else if (local) {
          draft.push({ title, artifact: local, status: 'local-only' })
        } else if (wiki) {
          draft.push({ title, slug: wiki.slug, status: 'wiki-only' })
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
          prev.map((i) =>
            i.title === item.title ? { ...i, status, localContent, wikiContent } : i
          )
        )
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Erro ao carregar wiki')
      setLoading(false)
    }
  }

  async function handlePush(item: SyncItem) {
    setBusy(item.title)
    setAiStatus('Lendo padrão da wiki…')

    const api = window.electronAPI!

    // Busca conteúdo local
    const localContent = item.localContent
      ?? (item.artifact ? await api.artifactsRead(item.artifact.id).catch(() => '') : '')

    // Busca Home e uma página existente como referência de padrão
    let homeContent = ''
    let patternContent = ''

    if (homePage.current) {
      const homeFull = await api.gitlab.wikiGet(gitlabProjectPath, homePage.current.slug).catch(() => null)
      homeContent = homeFull?.content ?? ''
    }

    const syncedItem = items.find((i) => i.status === 'synced' && i.slug)
    if (syncedItem) {
      const ref = await api.gitlab.wikiGet(gitlabProjectPath, syncedItem.slug!).catch(() => null)
      patternContent = ref?.content ?? ''
    }

    const homeSection = homeContent
      ? `\nHOME PAGE ATUAL DA WIKI:\n${homeContent}\n`
      : ''
    const patternSection = patternContent
      ? `\nEXEMPLO DE PÁGINA JÁ PUBLICADA NA WIKI (use como referência de formatação):\n${patternContent}\n`
      : ''

    const prompt =
      `Você vai publicar a seguinte história na wiki do GitLab do projeto "${gitlabProjectPath}".
${patternSection}${homeSection}
CONTEÚDO LOCAL A PUBLICAR (título: "${item.title}"):
${localContent}

TAREFAS:
1. Formate o conteúdo da história seguindo o padrão das páginas existentes na wiki.
2. Se houver uma Home page, atualize-a para incluir o link para esta história (se ainda não estiver lá).

Responda APENAS com os dois blocos abaixo, sem nenhum texto adicional:

<HISTORIA>
[conteúdo formatado da história]
</HISTORIA>

<HOME>
[conteúdo atualizado da home page, ou deixe vazio se não houver home]
</HOME>`

    setAiStatus('Formatando com IA…')
    pushTargetRef.current = { ...item, localContent }
    aiAccRef.current = ''
    api.sendPrompt(prompt)
  }

  async function handlePull(item: SyncItem) {
    setBusy(item.title)
    try {
      const api   = window.electronAPI!
      const full  = await api.gitlab.wikiGet(gitlabProjectPath, item.slug!)
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

  const isBusy = busy !== null

  return (
    <div className="modal-overlay" onClick={onClose}>
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
          <div className="wiki-sync-list">
            <div className="wiki-sync-header">
              <span>Título</span>
              <span>Status</span>
              <span>Ações</span>
            </div>
            {items.map((item) => (
              <div key={item.title} className="wiki-sync-row">
                <span className="wiki-sync-title" title={item.title}>
                  {item.title.length > 36 ? item.title.slice(0, 36) + '…' : item.title}
                </span>
                <span className={`wiki-sync-status ${STATUS_CLS[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="wiki-sync-actions">
                  {(item.status === 'local-only' || item.status === 'diverged') && (
                    <button
                      className="wiki-sync-btn wiki-sync-btn-push"
                      disabled={isBusy}
                      onClick={() => handlePush(item)}
                      title="Formatar com IA e enviar para wiki"
                    >
                      {busy === item.title && aiStatus ? '…' : '⬆ Enviar'}
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
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={onClose} disabled={isBusy}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
