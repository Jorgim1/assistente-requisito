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
  loading:    '…',
  synced:     '✅ Sincronizado',
  diverged:   '⚠ Desatualizado',
  'local-only': '🖥 Apenas local',
  'wiki-only':  '☁ Apenas na wiki',
}

const STATUS_CLS: Record<SyncStatus, string> = {
  loading:    'sync-status-loading',
  synced:     'sync-status-synced',
  diverged:   'sync-status-diverged',
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
  const [items, setItems]   = useState<SyncItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [busy, setBusy]     = useState<string | null>(null)   // title sendo operado

  useEffect(() => {
    load()
  }, [gitlabProjectPath])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const api = window.electronAPI!
      const wikiPages: WikiPage[] = await api.gitlab.wikiList(gitlabProjectPath)

      // Mapeia wiki por slug normalizado
      const wikiBySlug = new Map<string, WikiPage>()
      for (const p of wikiPages) {
        wikiBySlug.set(slugify(p.title), p)
        wikiBySlug.set(slugify(p.slug), p)
      }

      // Mapeia artefatos locais por slug normalizado
      const localBySlug = new Map<string, Artifact>()
      for (const a of localArtifacts) {
        localBySlug.set(slugify(a.title), a)
      }

      const allKeys = new Set([...wikiBySlug.keys(), ...localBySlug.keys()])
      const draft: SyncItem[] = []

      for (const key of allKeys) {
        const wiki = wikiBySlug.get(key)
        const local = localBySlug.get(key)
        const title = local?.title ?? wiki?.title ?? key

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

      // Busca conteúdo dos itens com correspondência para comparar
      const matched = draft.filter((i) => i.status === 'loading')
      for (const item of matched) {
        const [wikiPage, localContent] = await Promise.all([
          api.gitlab.wikiGet(gitlabProjectPath, item.slug!),
          item.artifact ? api.artifactsRead(item.artifact.id).catch(() => '') : Promise.resolve(''),
        ])
        const wikiContent = wikiPage?.content ?? ''
        const status: SyncStatus = localContent.trim() === wikiContent.trim() ? 'synced' : 'diverged'
        setItems((prev) =>
          prev.map((i) =>
            i.title === item.title
              ? { ...i, status, localContent, wikiContent }
              : i
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
    try {
      const api = window.electronAPI!
      const content = item.localContent ?? await api.artifactsRead(item.artifact!.id)
      if (item.slug) {
        // Atualiza página existente
        await api.gitlab.wikiUpdate(gitlabProjectPath, item.slug, content, item.title)
      } else {
        // Cria nova página
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

  async function handlePull(item: SyncItem) {
    setBusy(item.title)
    try {
      const api = window.electronAPI!
      const full = await api.gitlab.wikiGet(gitlabProjectPath, item.slug!)
      if (!full?.content) return
      if (item.artifact) {
        await api.artifactsUpdate(item.artifact.id, full.content)
        onArtifactSaved({ ...item.artifact })
        setItems((prev) =>
          prev.map((i) =>
            i.title === item.title
              ? { ...i, status: 'synced', localContent: full.content, wikiContent: full.content }
              : i
          )
        )
      } else {
        const artifact = await api.artifactsCreate(projectId, 'historia', item.title, full.content, projectFolderPath)
        onArtifactSaved(artifact)
        setItems((prev) =>
          prev.map((i) =>
            i.title === item.title
              ? { ...i, status: 'synced', artifact, localContent: full.content, wikiContent: full.content }
              : i
          )
        )
      }
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
                  {item.status === 'local-only' && (
                    <button
                      className="wiki-sync-btn wiki-sync-btn-push"
                      disabled={isBusy}
                      onClick={() => handlePush(item)}
                      title="Enviar para wiki"
                    >
                      {busy === item.title ? '…' : '⬆ Enviar'}
                    </button>
                  )}
                  {item.status === 'wiki-only' && (
                    <button
                      className="wiki-sync-btn wiki-sync-btn-pull"
                      disabled={isBusy}
                      onClick={() => handlePull(item)}
                      title="Importar da wiki"
                    >
                      {busy === item.title ? '…' : '⬇ Importar'}
                    </button>
                  )}
                  {item.status === 'diverged' && (
                    <>
                      <button
                        className="wiki-sync-btn wiki-sync-btn-push"
                        disabled={isBusy}
                        onClick={() => handlePush(item)}
                        title="Enviar versão local para wiki"
                      >
                        {busy === item.title ? '…' : '⬆ Enviar'}
                      </button>
                      <button
                        className="wiki-sync-btn wiki-sync-btn-pull"
                        disabled={isBusy}
                        onClick={() => handlePull(item)}
                        title="Importar versão da wiki"
                      >
                        {busy === item.title ? '…' : '⬇ Importar'}
                      </button>
                    </>
                  )}
                  {item.status === 'synced' && (
                    <span className="wiki-sync-ok">—</span>
                  )}
                  {item.status === 'loading' && (
                    <span className="wiki-sync-ok">…</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
