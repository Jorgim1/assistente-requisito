import React, { useEffect, useRef, useState } from 'react'
import type { Project, Artifact, ArtifactType } from '../electron'
import WikiSyncModal from './WikiSyncModal'

// "Estimated Usage | resets on 2026-12-01 | KIRO PRO+ Credits (433.77 of 2000 ...) 21.7%"
// → linha 1: "KIRO PRO+ | resets on 2026-12-01"
// → linha 2: "Credits (433.77 of 2000 ...) 21.7%"
function CreditsDisplay({ raw }: { raw: string }) {
  const parts = raw.split('|').map((p) => p.trim())
  // Localiza parte com "Credits" (plano + valores)
  const credPart = parts.find((p) => p.includes('Credits')) ?? parts[parts.length - 1]
  // Localiza parte com "resets on"
  const resetPart = parts.find((p) => p.toLowerCase().includes('resets on')) ?? ''

  // Separa nome do plano do restante em "KIRO PRO+ Credits (...) 21.7%"
  const credIdx = credPart.indexOf('Credits')
  const planName  = credIdx > 0 ? credPart.slice(0, credIdx).trim() : ''
  const rawCred   = credIdx >= 0 ? credPart.slice(credIdx).trim() : credPart
  // Remove tudo após o primeiro percentual (ex.: "21.7% Overages: Disabled...")
  const pctMatch  = rawCred.match(/^(.*?\d+\.?\d*%)\s/)
  const credValue = pctMatch ? pctMatch[1] : rawCred

  const line1 = [planName, resetPart].filter(Boolean).join(' | ')
  const line2 = credValue

  return (
    <>
      {line1 && <div className="sidebar-credits-line sidebar-credits-line-bold">{line1}</div>}
      {line2 && <div className="sidebar-credits-line">{line2}</div>}
      {!line1 && !line2 && <div className="sidebar-credits-line">{raw}</div>}
    </>
  )
}

const ARTIFACT_ICON: Record<ArtifactType, string> = {
  historia:  '📄',
  anexo:     '📋',
  validacao: '✅',
  lacuna:    '❓',
}

function groupArtifactsByFolder(arts: Artifact[], projectPath: string): {
  direct: Artifact[]
  byFolder: Record<string, Artifact[]>
} {
  const direct: Artifact[] = []
  const byFolder: Record<string, Artifact[]> = {}
  // Normaliza e garante barra final para evitar correspondências parciais
  const base = projectPath.replace(/\\/g, '/').replace(/\/$/, '') + '/'
  for (const art of arts) {
    const filePath = art.filePath.replace(/\\/g, '/')
    if (!filePath.startsWith(base)) { direct.push(art); continue }
    const rel   = filePath.slice(base.length)
    const parts = rel.split('/')
    if (parts[0] === '.assistente' || parts.length <= 1) {
      // Arquivo na raiz do projeto ou dentro de .assistente → direto
      direct.push(art)
    } else {
      const folder = parts[0]
      byFolder[folder] = byFolder[folder] ?? []
      byFolder[folder].push(art)
    }
  }
  return { direct, byFolder }
}

interface SidebarProps {
  projects: Project[]
  artifacts: Record<string, Artifact[]>
  subfolders: Record<string, string[]>
  activeProjectId: string | null
  activeArtifactId: string | null
  selectedArtifactIds: Set<string>
  onSelectProject: (id: string) => void
  onSelectArtifact: (artifact: Artifact) => void
  onToggleArtifactSelect: (id: string) => void
  onSelectArtifacts: (ids: string[]) => void
  onSetSelection: (ids: string[]) => void
  onRenameArtifact: (id: string, newTitle: string) => void
  onNewProject: (name: string, gitlabProjectPath?: string) => void
  onInitializeProject: (folderPath: string, gitlabProjectPath?: string) => void
  onUpdateProjectGitlab: (projectId: string, projectPath: string, gitlabProjectPath: string) => void
  onDeleteProject: (id: string) => void
  onDeleteArtifact: (id: string) => void
  onBulkDeleteArtifacts: (ids: string[]) => void
  onNewHistoria: (projectId: string) => void
  onNewAnexo: (projectId: string) => void
  onNewValidacao: (projectId: string) => void
  onArtifactSaved: (artifact: Artifact) => void
  userEmail?: string | null
  credits?: string | null
  creditsLoading?: boolean
  onRefreshCredits?: () => void
  onOpenSettings: () => void
  isProcessing: boolean
  width: number
  onWidthChange: (w: number) => void
}

export default function Sidebar({
  projects,
  artifacts,
  subfolders,
  activeProjectId,
  activeArtifactId,
  selectedArtifactIds,
  onSelectProject,
  onSelectArtifact,
  onToggleArtifactSelect,
  onSelectArtifacts,
  onSetSelection,
  onRenameArtifact,
  onNewProject,
  onInitializeProject,
  onUpdateProjectGitlab,
  onDeleteProject,
  onDeleteArtifact,
  onBulkDeleteArtifacts,
  onNewHistoria,
  onNewAnexo,
  onNewValidacao,
  onArtifactSaved,
  userEmail,
  credits,
  creditsLoading,
  onRefreshCredits,
  onOpenSettings,
  isProcessing,
  width,
  onWidthChange,
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders]   = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'artifact' | 'bulk'; id?: string } | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState<string | null>(null)
  const [newProjectGitlab, setNewProjectGitlab] = useState('')
  const [editGitlabProjectId, setEditGitlabProjectId] = useState<string | null>(null)
  const [editGitlabValue, setEditGitlabValue] = useState('')
  const [wikiOpen, setWikiOpen] = useState(false)
  const [artifactMenu, setArtifactMenu] = useState<string | null>(null)
  const [renameId, setRenameId]   = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const newProjectInputRef = useRef<HTMLInputElement>(null)
  const lastSelectedRef = useRef<string | null>(null)

  useEffect(() => {
    if (renameId !== null) renameInputRef.current?.focus()
  }, [renameId])

  useEffect(() => {
    if (!artifactMenu) return
    const close = () => setArtifactMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [artifactMenu])

  useEffect(() => {
    if (newProjectName !== null) newProjectInputRef.current?.focus()
  }, [newProjectName])

  const handleNewProjectConfirm = () => {
    if (newProjectName && newProjectName.trim()) {
      onNewProject(newProjectName.trim(), newProjectGitlab.trim() || undefined)
    }
    setNewProjectName(null)
    setNewProjectGitlab('')
  }

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleExpand = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      onWidthChange(Math.max(180, Math.min(400, startW + ev.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleRenameConfirm = (id: string) => {
    const v = renameValue.trim()
    if (v) onRenameArtifact(id, v)
    setRenameId(null)
  }

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return
    if (confirmDelete.type === 'project') onDeleteProject(confirmDelete.id!)
    else if (confirmDelete.type === 'artifact') onDeleteArtifact(confirmDelete.id!)
    else if (confirmDelete.type === 'bulk') onBulkDeleteArtifacts([...selectedArtifactIds])
    setConfirmDelete(null)
  }

  const selectionCount = selectedArtifactIds.size

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-header">
        {newProjectName !== null ? (
          <div className="sidebar-new-project-form">
            <input
              ref={newProjectInputRef}
              className="sidebar-new-project-input"
              placeholder="Nome do projeto…"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewProjectConfirm()
                else if (e.key === 'Escape') { setNewProjectName(null); setNewProjectGitlab('') }
              }}
            />
            <input
              className="sidebar-new-project-input sidebar-new-project-gitlab"
              placeholder="GitLab: grupo/projeto (opcional)"
              value={newProjectGitlab}
              onChange={(e) => setNewProjectGitlab(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewProjectConfirm()
                else if (e.key === 'Escape') { setNewProjectName(null); setNewProjectGitlab('') }
              }}
            />
            <div className="sidebar-new-project-actions">
              <button className="sidebar-new-project-cancel" onClick={() => { setNewProjectName(null); setNewProjectGitlab('') }}>Cancelar</button>
              <button className="sidebar-new-project-ok" onClick={handleNewProjectConfirm} disabled={!newProjectName?.trim()}>Criar</button>
            </div>
          </div>
        ) : (
          <>
            <span className="sidebar-title">Requisitos</span>
            <button
              className="sidebar-new-btn"
              onClick={() => setNewProjectName('')}
              title="Novo projeto"
            >+</button>
          </>
        )}
      </div>

      {/* Ações rápidas — visíveis quando há projeto ativo */}
      {activeProjectId && (
        <div className="sidebar-quick-actions">
          <button
            className="sidebar-qa-btn"
            onClick={() => onNewHistoria(activeProjectId)}
            disabled={isProcessing}
            title="Extrair Histórias de Usuário"
          >
            📄 Histórias
          </button>
          <button
            className="sidebar-qa-btn"
            onClick={() => onNewAnexo(activeProjectId)}
            disabled={isProcessing}
            title="Gerar Anexo Técnico"
          >
            📋 Anexo
          </button>
          <button
            className="sidebar-qa-btn"
            onClick={() => onNewValidacao(activeProjectId)}
            disabled={isProcessing}
            title="Validar História (DoR)"
          >
            ✅ Validar
          </button>
          {projects.find((p) => p.id === activeProjectId)?.gitlabProjectPath && (
            <button
              className="sidebar-qa-btn sidebar-qa-btn-gitlab"
              onClick={() => setWikiOpen(true)}
              title="Importar da Wiki do GitLab"
            >
              🌐 Wiki
            </button>
          )}
        </div>
      )}

      {/* Barra de seleção — aparece quando há artefatos selecionados */}
      {selectionCount > 0 && (
        <div className="sidebar-selection-bar">
          <span className="sidebar-sel-count">{selectionCount} selecionado{selectionCount > 1 ? 's' : ''}</span>
          <button
            className="sidebar-sel-delete"
            title="Excluir selecionados"
            onClick={() => setConfirmDelete({ type: 'bulk' })}
          >
            🗑 Excluir
          </button>
        </div>
      )}

      <div className="sidebar-list">
        {projects.length === 0 && (
          <div className="sidebar-empty">
            Nenhum projeto.<br />Clique em + para criar.
          </div>
        )}

        {projects.map((project) => {
          if (!project.isProject) {
            // ── Pasta comum (sem marcador) ────────────────────────
            return (
              <div key={project.id} className="sidebar-folder">
                <span className="sidebar-folder-icon">📁</span>
                <span className="sidebar-folder-name" title={project.path}>{project.name}</span>
                <button
                  className="sidebar-folder-init"
                  title="Inicializar como projeto"
                  onClick={() => onInitializeProject(project.path)}
                >
                  + proj
                </button>
              </div>
            )
          }

          // ── Projeto real (com marcador) ───────────────────────
          const isExpanded = expandedProjects.has(project.id)
          const isActive   = activeProjectId === project.id
          const projectArtifacts = artifacts[project.id] ?? []

          return (
            <div key={project.id} className="sidebar-project">
              <div
                className={`sidebar-project-header${isActive ? ' active' : ''}`}
                onClick={() => {
                  toggleExpand(project.id)
                  if (!isProcessing) onSelectProject(project.id)
                }}
              >
                <span className="sidebar-project-arrow">{isExpanded ? '▼' : '▶'}</span>
                <span className="sidebar-project-name" title={project.path}>{project.name}</span>

                <div className="sidebar-project-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="sidebar-action-btn"
                    title="Ações do projeto"
                    onClick={() => setActionMenu(actionMenu === project.id ? null : project.id)}
                  >
                    ⋯
                  </button>
                  {actionMenu === project.id && (
                    <div className="sidebar-action-menu">
                      <button onClick={() => { onNewHistoria(project.id); setActionMenu(null) }}>
                        {ARTIFACT_ICON.historia} Nova História
                      </button>
                      <button onClick={() => { onNewAnexo(project.id); setActionMenu(null) }}>
                        {ARTIFACT_ICON.anexo} Novo Anexo Técnico
                      </button>
                      <button onClick={() => { onNewValidacao(project.id); setActionMenu(null) }}>
                        {ARTIFACT_ICON.validacao} Nova Validação
                      </button>
                      <div className="sidebar-menu-divider" />
                      <button onClick={() => {
                        setEditGitlabProjectId(project.id)
                        setEditGitlabValue(project.gitlabProjectPath ?? '')
                        setActionMenu(null)
                      }}>
                        🌐 {project.gitlabProjectPath ? 'Editar GitLab' : 'Vincular GitLab'}
                      </button>
                      <div className="sidebar-menu-divider" />
                      <button
                        className="sidebar-menu-danger"
                        onClick={() => { setConfirmDelete({ type: 'project', id: project.id }); setActionMenu(null) }}
                      >
                        Desfazer como projeto
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (() => {
                const { direct, byFolder } = groupArtifactsByFolder(projectArtifacts, project.path)
                const projectSubfolders = subfolders[project.id] ?? []
                // União de pastas com artefatos + pastas vazias conhecidas
                const allFolders = Array.from(new Set([...projectSubfolders, ...Object.keys(byFolder)]))
                  .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
                const isEmpty = projectArtifacts.length === 0 && allFolders.length === 0

                const renderArtifact = (artifact: Artifact) => {
                  const isSelected = selectedArtifactIds.has(artifact.id)
                  return (
                    <div
                      key={artifact.id}
                      data-artifact-id={artifact.id}
                      className={`sidebar-artifact${activeArtifactId === artifact.id ? ' active' : ''}${isSelected ? ' selected' : ''}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.sidebar-artifact-del, .sidebar-artifact-menu, .sidebar-artifact-rename')) return
                        if (renameId === artifact.id) return
                        e.stopPropagation()
                        setArtifactMenu(null)
                        if (e.shiftKey && lastSelectedRef.current !== null) {
                          // Shift+click: range select, sem abrir
                          const nodes = Array.from(
                            document.querySelectorAll<HTMLElement>('.sidebar-artifact[data-artifact-id]')
                          )
                          const ids = nodes.map((n) => n.getAttribute('data-artifact-id')!)
                          const fromIdx = ids.indexOf(lastSelectedRef.current)
                          const toIdx   = ids.indexOf(artifact.id)
                          if (fromIdx >= 0 && toIdx >= 0) {
                            const start = Math.min(fromIdx, toIdx)
                            const end   = Math.max(fromIdx, toIdx)
                            onSelectArtifacts(ids.slice(start, end + 1))
                          }
                        } else if (e.ctrlKey || e.metaKey) {
                          // Ctrl+click: toggle individual, sem abrir
                          onToggleArtifactSelect(artifact.id)
                        } else {
                          // Click simples: seleciona só esse + abre
                          onSetSelection([artifact.id])
                          if (!isProcessing) onSelectArtifact(artifact)
                        }
                        lastSelectedRef.current = artifact.id
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setArtifactMenu(artifactMenu === artifact.id ? null : artifact.id)
                      }}
                    >
                      <span className="sidebar-artifact-icon">{ARTIFACT_ICON[artifact.type]}</span>

                      {renameId === artifact.id ? (
                        <input
                          ref={renameInputRef}
                          className="sidebar-artifact-rename"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')  handleRenameConfirm(artifact.id)
                            if (e.key === 'Escape') setRenameId(null)
                          }}
                          onBlur={() => handleRenameConfirm(artifact.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="sidebar-artifact-title" title={artifact.title}>{artifact.title}</span>
                      )}

                      <div className="sidebar-artifact-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="sidebar-artifact-del"
                          title="Opções"
                          onClick={() => setArtifactMenu(artifactMenu === artifact.id ? null : artifact.id)}
                        >⋯</button>
                        {artifactMenu === artifact.id && (
                          <div className="sidebar-artifact-dropdown">
                            <button onClick={() => {
                              setRenameValue(artifact.title)
                              setRenameId(artifact.id)
                              setArtifactMenu(null)
                            }}>✏ Renomear</button>
                            <button
                              className="sidebar-menu-danger"
                              onClick={() => { setConfirmDelete({ type: 'artifact', id: artifact.id }); setArtifactMenu(null) }}
                            >🗑 Excluir</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="sidebar-artifacts">
                    {isEmpty && <div className="sidebar-artifacts-empty">Nenhum artefato</div>}

                    {/* Artefatos diretos do .assistente */}
                    {direct.map(renderArtifact)}

                    {/* Subpastas com seus artefatos */}
                    {allFolders.map((folder) => {
                      const folderKey = `${project.id}:${folder}`
                      const folderArtifacts = byFolder[folder] ?? []
                      const isFolderExpanded = expandedFolders.has(folderKey)
                      return (
                        <div key={folderKey} className="sidebar-subfolder">
                          <div className="sidebar-subfolder-header" onClick={() => toggleFolder(folderKey)}>
                            <span className="sidebar-subfolder-arrow">{isFolderExpanded ? '▾' : '▸'}</span>
                            <span className="sidebar-subfolder-icon">📁</span>
                            <span className="sidebar-subfolder-name">{folder}</span>
                            {folderArtifacts.length > 0 && (
                              <span className="sidebar-subfolder-count">{folderArtifacts.length}</span>
                            )}
                          </div>
                          {isFolderExpanded && (
                            <div className="sidebar-subfolder-items">
                              {folderArtifacts.length === 0
                                ? <div className="sidebar-artifacts-empty">Pasta vazia</div>
                                : folderArtifacts.map(renderArtifact)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      <div className="sidebar-footer">
        {/* Linha 1: settings + email */}
        <div className="sidebar-footer-row">
          <button className="sidebar-settings-btn" onClick={onOpenSettings} title="Configurações">
            ⚙
          </button>
          {userEmail && (
            <span className="sidebar-email" title={userEmail}>{userEmail}</span>
          )}
        </div>
        {/* Créditos: 2 linhas formatadas */}
        {credits != null && (
          <div
            className={`sidebar-credits${creditsLoading ? ' loading' : ''}`}
            title={credits + '\n\nClique para atualizar'}
            onClick={onRefreshCredits}
          >
            {creditsLoading ? (
              <span className="spin-icon">⟳</span>
            ) : (
              <CreditsDisplay raw={credits} />
            )}
          </div>
        )}
      </div>

      {/* Modal: vincular/editar GitLab project path */}
      {editGitlabProjectId && (() => {
        const proj = projects.find((p) => p.id === editGitlabProjectId)
        if (!proj) return null
        return (
          <div className="sidebar-confirm-overlay" onClick={() => setEditGitlabProjectId(null)}>
            <div className="sidebar-confirm-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Vincular projeto ao GitLab</p>
              <p style={{ fontSize: 12, color: 'var(--gray-mute)', marginBottom: 10 }}>
                Informe o caminho do projeto no GitLab (ex: grupo/subgrupo/projeto):
              </p>
              <input
                className="sidebar-new-project-input"
                autoFocus
                placeholder="grupo/projeto"
                value={editGitlabValue}
                onChange={(e) => setEditGitlabValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateProjectGitlab(proj.id, proj.path, editGitlabValue.trim())
                    setEditGitlabProjectId(null)
                  }
                  if (e.key === 'Escape') setEditGitlabProjectId(null)
                }}
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div className="sidebar-confirm-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    onUpdateProjectGitlab(proj.id, proj.path, editGitlabValue.trim())
                    setEditGitlabProjectId(null)
                  }}
                >
                  Salvar
                </button>
                <button onClick={() => setEditGitlabProjectId(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: wiki do GitLab */}
      {wikiOpen && activeProjectId && (() => {
        const proj = projects.find((p) => p.id === activeProjectId)
        if (!proj?.gitlabProjectPath) return null
        return (
          <WikiSyncModal
            gitlabProjectPath={proj.gitlabProjectPath}
            projectId={proj.id}
            projectFolderPath={proj.path}
            localArtifacts={artifacts[proj.id] ?? []}
            onClose={() => setWikiOpen(false)}
            onArtifactSaved={(artifact) => { onArtifactSaved(artifact) }}
          />
        )
      })()}

      {confirmDelete && (
        <div className="sidebar-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="sidebar-confirm-box" onClick={(e) => e.stopPropagation()}>
            <p>
              {confirmDelete.type === 'project'
                ? 'Desfazer como projeto? A pasta e os arquivos não serão apagados — a pasta volta a aparecer como pasta comum.'
                : confirmDelete.type === 'bulk'
                ? `Excluir ${selectionCount} artefato${selectionCount > 1 ? 's' : ''} selecionado${selectionCount > 1 ? 's' : ''}? Os arquivos no disco também serão removidos.`
                : 'Excluir este artefato?'}
            </p>
            <div className="sidebar-confirm-actions">
              <button onClick={handleDeleteConfirm} className="btn-danger">
                {confirmDelete.type === 'project' ? 'Desfazer' : 'Excluir'}
              </button>
              <button onClick={() => setConfirmDelete(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-resize-handle" onMouseDown={onMouseDown} />
    </aside>
  )
}
