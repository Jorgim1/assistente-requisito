import React, { useEffect, useState } from 'react'
import type { Artifact } from '../electron'
import MarkdownRenderer from './MarkdownRenderer'

const TYPE_LABEL: Record<string, string> = {
  historia:  'História',
  anexo:     'Anexo Técnico',
  validacao: 'Validação DoR',
}

interface Props {
  artifact: Artifact
  onDelete: () => void
}

export default function ArtifactView({ artifact, onDelete }: Props) {
  const [content, setContent]       = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isEditing, setIsEditing]   = useState(false)
  const [editText, setEditText]     = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    setContent(null)
    setIsEditing(false)
    window.electronAPI?.artifactsRead(artifact.id).then((c) => {
      setContent(c)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [artifact.id])

  const handleStartEdit = () => {
    setEditText(content ?? '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => setIsEditing(false)

  const handleSaveEdit = async () => {
    if (editSaving) return
    setEditSaving(true)
    try {
      await window.electronAPI?.artifactsUpdate(artifact.id, editText)
      setContent(editText)
      setIsEditing(false)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="artifact-view artifact-view-simple">
      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div className="artifact-view-header">
        <div className="artifact-view-meta">
          <span className="artifact-view-type">{TYPE_LABEL[artifact.type] ?? artifact.type}</span>
          <h2 className="artifact-view-title">{artifact.title}</h2>
          <span className="artifact-view-date">
            {new Date(artifact.createdAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
        <div className="artifact-view-actions">
          {isEditing ? (
            <>
              <button className="artifact-btn artifact-btn-save" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Salvando…' : '💾 Salvar'}
              </button>
              <button className="artifact-btn" onClick={handleCancelEdit}>Cancelar</button>
            </>
          ) : (
            <>
              <button className="artifact-btn" onClick={handleStartEdit} disabled={loading || !content}>
                ✏ Editar
              </button>
              <button className="artifact-btn danger" onClick={() => setConfirmDelete(true)}>
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────── */}
      <div className="artifact-content-full">
        {loading && <p className="artifact-loading">Carregando…</p>}
        {!loading && !content && <p className="artifact-loading">Arquivo não encontrado.</p>}
        {!loading && content && !isEditing && (
          <MarkdownRenderer content={content} />
        )}
        {!loading && isEditing && (
          <textarea
            className="artifact-edit-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      {confirmDelete && (
        <div className="sidebar-confirm-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="sidebar-confirm-box" onClick={(e) => e.stopPropagation()}>
            <p>Excluir este artefato? O arquivo no disco também será removido.</p>
            <div className="sidebar-confirm-actions">
              <button className="btn-danger" onClick={() => { setConfirmDelete(false); onDelete() }}>Excluir</button>
              <button onClick={() => setConfirmDelete(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
