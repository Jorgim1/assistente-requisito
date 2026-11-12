import React, { useEffect, useState } from 'react'
import type { WikiPage, Artifact } from '../electron'

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
  const [items, setItems]           = useState<SyncItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [busy, setBusy]             = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [dlProgress, setDlProgress] = useState('')

  useEffect(() => { load() }, [gitlabProjectPath])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const api = window.electronAPI!
      const wikiPages: WikiPage[] = await api.gitlab.wikiList(gitlabProjectPath)

      const wikiBySlug = new Map<string, WikiPage>()
      for (const p of wikiPages) {
        wikiBySlug.set(p.slug,           p)
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
          prev.map((i) => i.title === item.title ? { ...i, status, localContent, wikiContent } : i)
        )
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Erro ao carregar wiki')
      setLoading(false)
    }
  }

  // Baixa TODAS as páginas da wiki como artefatos locais
  async function handleDownloadAll() {
    setDownloading(true)
    const api = window.electronAPI!
    try {
      const pages = items.filter((i) => i.slug)
      for (let idx = 0; idx < pages.length; idx++) {
        const item = pages[idx]
        setDlProgress(`Baixando ${idx + 1}/${pages.length}: ${item.title}`)
        const full = await api.gitlab.wikiGet(gitlabProjectPath, item.slug!)
        if (!full?.content) continue

        if (item.artifact) {
          await api.artifactsUpdate(item.artifact.id, full.content)
          onArtifactSaved({ ...item.artifact })
        } else {
          const artifact = await api.artifactsCreate(
            projectId, 'historia', item.title, full.content, projectFolderPath,
          )
          onArtifactSaved(artifact)
        }

        setItems((prev) =>
          prev.map((i) =>
            i.title === item.title
              ? { ...i, status: 'synced', wikiContent: full.content, localContent: full.content }
              : i
          )
        )
      }
    } finally {
      setDownloading(false)
      setDlProgress('')
    }
  }

  // Envia artefato local para wiki (push direto, sem AI)
  async function handlePush(item: SyncItem) {
    setBusy(item.title)
    try {
      const api = window.electronAPI!
      const content = item.localContent
        ?? (item.artifact ? await api.artifactsRead(item.artifact.id).catch(() => '') : '')
      if (item.slug) {
        await api.gitlab.wikiUpdate(gitlabProjectPath, item.slug, content, item.title)
      } else {
        await api.gitlab.wikiCreate(gitlabProjectPath, item.title, content)
      }
      setItems((prev) =>
        prev.map((i) => i.title === item.title ? { ...i, status: 'synced', wikiContent: content } : i)
      )
    } catch (err) {
      console.error('Erro ao enviar para wiki:', err)
    } finally {
      setBusy(null)
    }
  }

  // Importa página da wiki como artefato local
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
        const artifact = await api.artifactsCreate(
          projectId, 'historia', item.title, full.content, projectFolderPath,
        )
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

  const isBusy = busy !== null || downloading
  const wikiOnlyCount  = items.filter((i) => i.status === 'wiki-only').length
  const localOnlyCount = items.filter((i) => i.status === 'local-only').length
  const divergedCount  = items.filter((i) => i.status === 'diverged').length

  return (
    <div className="modal-overlay" onClick={isBusy ? undefined : onClose}>
      <div className="modal-card wiki-sync-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Sincronizar Wiki</div>
        <p className="wiki-modal-project">{gitlabProjectPath}</p>

        {downloading && (
          <div className="wiki-sync-ai-status">
            <span className="spin-icon">⟳</span> {dlProgress || 'Baixando…'}
          </div>
        )}

        {loading && <p className="wiki-modal-status">Carregando páginas…</p>}
        {error   && <p className="wiki-modal-error">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="wiki-modal-status">Nenhuma página encontrada.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            {/* Barra de ações em lote */}
            <div className="wiki-sync-batch-bar">
              <span className="wiki-sync-summary">
                {wikiOnlyCount > 0  && `${wikiOnlyCount} só na wiki  `}
                {localOnlyCount > 0 && `${localOnlyCount} só local  `}
                {divergedCount  > 0 && `${divergedCount} desatualizado`}
                {wikiOnlyCount + localOnlyCount + divergedCount === 0 && '✅ Tudo sincronizado'}
              </span>
              {wikiOnlyCount + divergedCount > 0 && (
                <button
                  className="wiki-sync-btn wiki-sync-btn-pull"
                  disabled={isBusy}
                  onClick={handleDownloadAll}
                  title="Baixa todas as páginas da wiki como artefatos locais"
                >
                  ⬇ Baixar tudo da wiki
                </button>
              )}
            </div>

            <div className="wiki-sync-hint">
              💡 Use o <strong>Chat</strong> com as páginas selecionadas para analisar a estrutura e decidir o que publicar.
            </div>

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
                        title="Enviar versão local para wiki"
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
                        {busy === item.title ? '…' : '⬇ Importar'}
                      </button>
                    )}
                    {item.status === 'synced'  && <span className="wiki-sync-ok">—</span>}
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
