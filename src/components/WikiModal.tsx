import React, { useEffect, useState } from 'react'
import type { WikiPage, Artifact } from '../electron'

interface Props {
  gitlabProjectPath: string
  projectId: string
  projectFolderPath: string
  onClose: () => void
  onArtifactSaved: (artifact: Artifact) => void
}

export default function WikiModal({ gitlabProjectPath, projectId, projectFolderPath, onClose, onArtifactSaved }: Props) {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electronAPI?.gitlab.wikiList(gitlabProjectPath)
      .then((p) => { setPages(p); setLoading(false) })
      .catch((err: Error) => { setError(err?.message ?? 'Erro ao carregar wiki'); setLoading(false) })
  }, [gitlabProjectPath])

  const handleImport = async (page: WikiPage) => {
    setImporting(page.slug)
    try {
      const full = await window.electronAPI?.gitlab.wikiGet(gitlabProjectPath, page.slug)
      if (!full?.content) { setImporting(null); return }
      const artifact = await window.electronAPI?.artifactsCreate(
        projectId,
        'historia',
        page.title,
        full.content,
        projectFolderPath,
      )
      if (artifact) onArtifactSaved(artifact)
    } catch (err: unknown) {
      console.error('Erro ao importar página da wiki:', err)
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wiki-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Wiki do GitLab</div>
        <p className="wiki-modal-project">{gitlabProjectPath}</p>

        {loading && <p className="wiki-modal-status">Carregando páginas…</p>}
        {error   && <p className="wiki-modal-error">{error}</p>}

        {!loading && !error && pages.length === 0 && (
          <p className="wiki-modal-status">Nenhuma página encontrada na wiki.</p>
        )}

        {!loading && !error && pages.length > 0 && (
          <div className="wiki-page-list">
            {pages.map((page) => (
              <div key={page.slug} className="wiki-page-row">
                <span className="wiki-page-title">{page.title}</span>
                <button
                  className="wiki-import-btn"
                  disabled={importing === page.slug}
                  onClick={() => handleImport(page)}
                >
                  {importing === page.slug ? 'Importando…' : 'Importar'}
                </button>
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
