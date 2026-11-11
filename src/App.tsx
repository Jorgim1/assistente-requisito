import React, { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import SettingsModal from './components/SettingsModal'
import WorkspaceSetup from './components/WorkspaceSetup'
import ArtifactView from './components/ArtifactView'
import LacunaView from './components/LacunaView'
import HistoriasPanel from './components/HistoriasPanel'
import DerivationPanel from './components/DerivationPanel'
import ReadinessPanel from './components/ReadinessPanel'
import GlobalChatPanel from './components/GlobalChatPanel'
import type { Project, Artifact, ArtifactType } from './electron'
// WikiPage type used by sidebar wiki import

type ActiveMode = 'artifact' | 'historia' | 'anexo' | 'validacao' | 'lacuna' | null

export default function App() {
  const [workspacePath, setWorkspacePath]     = useState<string | null>(null)
  const [workspaceReady, setWorkspaceReady]   = useState(false)
  const [projects, setProjects]               = useState<Project[]>([])
  const [artifacts, setArtifacts]             = useState<Record<string, Artifact[]>>({})
  const [subfolders, setSubfolders]           = useState<Record<string, string[]>>({})
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeArtifact, setActiveArtifact]   = useState<Artifact | null>(null)
  const [activeMode, setActiveMode]           = useState<ActiveMode>(null)

  const [acpStatus, setAcpStatus]             = useState('disconnected')
  const [credits, setCredits]                 = useState<string | null>(null)
  const [creditsLoading, setCreditsLoading]   = useState(false)
  const [userEmail, setUserEmail]             = useState<string | null>(null)
  const [currentModel, setCurrentModel]       = useState('auto')
  const [contextPct, setContextPct]           = useState<number | null>(null)
  const [isProcessing, setIsProcessing]       = useState(false)
  const [settingsOpen, setSettingsOpen]       = useState(false)
  const [sidebarWidth, setSidebarWidth]       = useState(230)
  const [chatPanelWidth, setChatPanelWidth]   = useState(300)
  const [toast, setToast]                     = useState<{ msg: string; ok: boolean } | null>(null)
  const [updateReady, setUpdateReady]         = useState(false)
  const [updateDownloading, setUpdateDownloading] = useState(false)
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [updateError, setUpdateError]         = useState<string | null>(null)

  // Seleção de artefatos na sidebar (para usar como contexto no chat)
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<string>>(new Set())

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto-sync da sidebar ───────────────────────────────────────
  // Varre o projeto ativo a cada 4s e atualiza artefatos se houver mudança no disco
  useEffect(() => {
    if (!activeProjectId) return
    const id = activeProjectId
    const proj = projects.find((p) => p.id === id)
    if (!proj || !proj.isProject) return
    const projectPath = proj.path
    const tick = async () => {
      const arts = await window.electronAPI?.artifactsList(id, projectPath).catch(() => null)
      if (!arts) return
      setArtifacts((prev) => {
        const current = prev[id] ?? []
        const changed =
          current.length !== arts.length ||
          current.some((a, i) => a.id !== arts[i]?.id || a.title !== arts[i]?.title || a.updatedAt !== arts[i]?.updatedAt)
        return changed ? { ...prev, [id]: arts } : prev
      })
    }
    const interval = setInterval(tick, 4000)
    return () => clearInterval(interval)
  }, [activeProjectId, projects])

  // ── Inicialização ──────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    Promise.all([
      api.workspaceGet(),
      api.projectsList(),
      api.getModel(),
    ]).then(([wp, projs, model]) => {
      setWorkspacePath(wp)
      setWorkspaceReady(!!wp)
      setProjects(projs)
      if (model) setCurrentModel(model)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (projects.length === 0) return
    const api = window.electronAPI
    if (!api) return
    Promise.all(
      projects.filter((p) => p.isProject).map((p) => api.artifactsList(p.id, p.path).then((arts) => [p.id, arts] as const))
    ).then((entries) => {
      setArtifacts(Object.fromEntries(entries))
    }).catch(() => {})
  }, [projects])

  // ── Eventos ACP / auto-update ──────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const u1 = api.onAcpStatus(setAcpStatus)
    const u2 = api.onAcpCredits((text) => setCredits(text))
    const u3 = api.onAcpWhoami(({ email }) => setUserEmail(email))
    const u4 = api.onContextUsage((pct) => setContextPct(pct))
    const u5 = api.onUpdateAvailable(() => { setUpdateDownloading(true); setDownloadPercent(0); setUpdateError(null) })
    const u6 = api.onUpdateDownloaded(() => { setUpdateDownloading(false); setDownloadPercent(0); setUpdateReady(true) })
    const u7 = api.onDownloadProgress(({ percent }) => setDownloadPercent(percent))
    const u8 = api.onUpdateError((msg) => { setUpdateDownloading(false); setUpdateError(msg) })
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8() }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setSettingsOpen(true) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const showToast = (msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Workspace setup ───────────────────────────────────────────
  const handleWorkspaceSet = async (p: string) => {
    await window.electronAPI?.workspaceSet(p)
    setWorkspacePath(p)
    setWorkspaceReady(true)
    window.electronAPI?.setCwd(p)
    // Recarrega projetos do novo workspace
    const projs = await window.electronAPI?.projectsList().catch(() => null)
    if (projs) setProjects(projs)
  }

  const handlePickWorkspace = async () => {
    const p = await window.electronAPI?.workspacePickFolder()
    if (p) handleWorkspaceSet(p)
  }

  // ── Projetos ──────────────────────────────────────────────────
  const handleNewProject = async (name: string, gitlabProjectPath?: string) => {
    const api = window.electronAPI
    if (!api || !name.trim()) return
    const project = await api.projectsCreate(name.trim(), gitlabProjectPath)
    setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })))
    setArtifacts((prev) => ({ ...prev, [project.id]: [] }))
    handleSelectProject(project.id, project)
  }

  const handleInitializeProject = async (folderPath: string, gitlabProjectPath?: string) => {
    const api = window.electronAPI
    if (!api) return
    const project = await api.projectsInitialize(folderPath, gitlabProjectPath)
    setProjects((prev) =>
      prev.map((p) => p.path === folderPath ? project : p)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
    )
    setArtifacts((prev) => ({ ...prev, [project.id]: [] }))
    handleSelectProject(project.id, project)
  }

  const handleUpdateProjectGitlab = async (projectId: string, projectPath: string, gitlabProjectPath: string) => {
    await window.electronAPI?.projectsUpdateGitlab(projectPath, gitlabProjectPath)
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, gitlabProjectPath: gitlabProjectPath || undefined } : p))
  }

  const handleSelectProject = (id: string, project?: Project) => {
    const proj = project ?? projects.find((p) => p.id === id)
    if (!proj || !proj.isProject) return
    setActiveProjectId(id)
    setActiveArtifact(null)
    setActiveMode(null)
    setSelectedArtifactIds(new Set())
    window.electronAPI?.setCwd(proj.path)
    window.electronAPI?.resetKiroSession()
    window.electronAPI?.artifactsList(id, proj.path).then((arts) => {
      setArtifacts((prev) => ({ ...prev, [id]: arts }))
    }).catch(() => {})
    window.electronAPI?.projectsSubfolders(proj.path).then((subs) => {
      setSubfolders((prev) => ({ ...prev, [id]: subs }))
    }).catch(() => {})
  }

  const handleDeleteProject = async (id: string) => {
    const proj = projects.find((p) => p.id === id)
    if (!proj) return
    await window.electronAPI?.projectsDelete(id, proj.path)
    // Converte para pasta comum na sidebar (sem remover da lista)
    setProjects((prev) => prev.map((p) =>
      p.id === id
        ? { ...p, id: `dir:${p.path}`, isProject: false, createdAt: 0, updatedAt: 0 }
        : p
    ))
    setArtifacts((prev) => { const next = { ...prev }; delete next[id]; return next })
    setSubfolders((prev) => { const next = { ...prev }; delete next[id]; return next })
    if (activeProjectId === id) {
      setActiveProjectId(null)
      setActiveArtifact(null)
      setActiveMode(null)
      setSelectedArtifactIds(new Set())
    }
  }

  // ── Artefatos ─────────────────────────────────────────────────
  const handleSelectArtifact = (artifact: Artifact) => {
    setActiveArtifact(artifact)
    setActiveMode('artifact')
    if (activeProjectId !== artifact.projectId) handleSelectProject(artifact.projectId)
  }

  const handleDeleteArtifact = async (id: string) => {
    await window.electronAPI?.artifactsDelete(id)
    setArtifacts((prev) => {
      const next = { ...prev }
      for (const pid of Object.keys(next)) next[pid] = next[pid].filter((a) => a.id !== id)
      return next
    })
    setSelectedArtifactIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    if (activeArtifact?.id === id) { setActiveArtifact(null); setActiveMode(null) }
  }

  const handleBulkDeleteArtifacts = async (ids: string[]) => {
    for (const id of ids) await window.electronAPI?.artifactsDelete(id).catch(() => {})
    setArtifacts((prev) => {
      const next = { ...prev }
      for (const pid of Object.keys(next)) next[pid] = next[pid].filter((a) => !ids.includes(a.id))
      return next
    })
    setSelectedArtifactIds(new Set())
    if (activeArtifact && ids.includes(activeArtifact.id)) { setActiveArtifact(null); setActiveMode(null) }
  }

  const handleToggleArtifactSelect = (id: string) => {
    setSelectedArtifactIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectArtifacts = (ids: string[]) => {
    setSelectedArtifactIds((prev) => new Set([...prev, ...ids]))
  }

  const handleSetSelection = (ids: string[]) => {
    setSelectedArtifactIds(new Set(ids))
  }

  const handleRenameArtifact = async (id: string, newTitle: string) => {
    const updated = await window.electronAPI?.artifactsRename(id, newTitle)
    if (!updated) return
    setArtifacts((prev) => {
      const next = { ...prev }
      for (const pid of Object.keys(next)) {
        next[pid] = next[pid].map((a) => a.id === id ? { ...a, title: updated.title, filePath: updated.filePath } : a)
      }
      return next
    })
    if (activeArtifact?.id === id) setActiveArtifact((a) => a ? { ...a, title: updated.title } : a)
  }

  const handleArtifactSaved = (artifact: Artifact) => {
    setArtifacts((prev) => ({
      ...prev,
      [artifact.projectId]: [
        artifact,
        ...(prev[artifact.projectId] ?? []).filter((a) => a.id !== artifact.id),
      ],
    }))
    setActiveArtifact(artifact)
    setActiveMode('artifact')
    showToast(`${artifact.type === 'historia' ? 'História' : artifact.type === 'anexo' ? 'Anexo Técnico' : 'Validação'} salva.`)
  }

  // ── Iniciar modo de criação ───────────────────────────────────
  const startMode = async (type: ArtifactType, projectId: string) => {
    await deactivateCurrentFeature()
    setActiveArtifact(null)
    setActiveMode(type)
    if (type === 'historia') {
      await window.electronAPI?.extrator?.activate('padrao')
    } else if (type === 'anexo') {
      await window.electronAPI?.derivation?.activate('lacunas')
    } else {
      await window.electronAPI?.readiness?.activate('gfo')
    }
  }

  const deactivateCurrentFeature = async () => {
    if (activeMode === 'historia')  await window.electronAPI?.extrator?.deactivate()
    if (activeMode === 'anexo')     await window.electronAPI?.derivation?.deactivate()
    if (activeMode === 'validacao') await window.electronAPI?.readiness?.deactivate()
  }

  const handleCancel = async () => {
    await deactivateCurrentFeature()
    setActiveMode(activeArtifact ? 'artifact' : null)
  }

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null

  // Artefatos selecionados (objetos completos) para passar ao GlobalChatPanel
  const allArtifacts = Object.values(artifacts).flat()
  const selectedArtifacts = allArtifacts.filter((a) => selectedArtifactIds.has(a.id))

  const handleModelChange = async (modelId: string) => {
    setCurrentModel(modelId)
    await window.electronAPI?.setModel(modelId)
  }

  const handleRefreshCredits = async () => {
    if (creditsLoading) return
    setCreditsLoading(true)
    await window.electronAPI?.refreshUsage()
    setCreditsLoading(false)
  }

  const panelCommonProps = {
    acpStatus,
    logOpen: false,
    onToggleLog: () => {},
    credits,
    creditsLoading,
    onRefreshCredits: handleRefreshCredits,
    currentModel,
    onProcessingChange: setIsProcessing,
    activeProject,
    onArtifactSaved: handleArtifactSaved,
    onCancel: handleCancel,
  }

  return (
    <div className="app">
      <TitleBar
        cwd={activeProject?.path ?? workspacePath ?? ''}
        onPickFolder={handlePickWorkspace}
        acpStatus={acpStatus}
        isProcessing={isProcessing}
        contextPct={contextPct}
        currentModel={currentModel}
        onModelChange={handleModelChange}
      />

      {updateDownloading && !updateReady && (
        <div className="update-banner downloading">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>⬇ Baixando atualização… {downloadPercent > 0 ? `${downloadPercent}%` : ''}</span>
            <button className="update-dismiss" onClick={() => setUpdateDownloading(false)}>✕</button>
          </div>
          <div className="update-progress-bar">
            <div className="update-progress-fill" style={{ width: `${Math.max(downloadPercent, downloadPercent === 0 ? 3 : 0)}%`, opacity: downloadPercent === 0 ? 0.4 : 1 }} />
          </div>
        </div>
      )}
      {updateError && (
        <div className="update-banner update-error">
          <span>⚠ Falha no download: {updateError}</span>
          <button className="update-dismiss" onClick={() => setUpdateError(null)}>✕</button>
        </div>
      )}
      {updateReady && (
        <div className="update-banner">
          <span>Nova versão pronta para instalar.</span>
          <button onClick={() => window.electronAPI?.installUpdate()}>Reiniciar e instalar</button>
          <button className="update-dismiss" onClick={() => setUpdateReady(false)}>✕</button>
        </div>
      )}

      <div className="app-body">
        {!workspaceReady ? (
          <WorkspaceSetup onConfirm={handleWorkspaceSet} />
        ) : (
          <>
            <Sidebar
              projects={projects}
              artifacts={artifacts}
              activeProjectId={activeProjectId}
              activeArtifactId={activeArtifact?.id ?? null}
              selectedArtifactIds={selectedArtifactIds}
              onSelectProject={(id) => handleSelectProject(id)}
              onSelectArtifact={handleSelectArtifact}
              onToggleArtifactSelect={handleToggleArtifactSelect}
              onSelectArtifacts={handleSelectArtifacts}
              onSetSelection={handleSetSelection}
              onRenameArtifact={handleRenameArtifact}
              subfolders={subfolders}
              onNewProject={handleNewProject}
              onInitializeProject={handleInitializeProject}
              onUpdateProjectGitlab={handleUpdateProjectGitlab}
              onDeleteProject={handleDeleteProject}
              onDeleteArtifact={handleDeleteArtifact}
              onBulkDeleteArtifacts={handleBulkDeleteArtifacts}
              onNewHistoria={(pid) => { handleSelectProject(pid); startMode('historia', pid) }}
              onNewAnexo={(pid) => { handleSelectProject(pid); startMode('anexo', pid) }}
              onNewValidacao={(pid) => { handleSelectProject(pid); startMode('validacao', pid) }}
              onArtifactSaved={handleArtifactSaved}
              userEmail={userEmail}
              credits={credits}
              creditsLoading={creditsLoading}
              onRefreshCredits={handleRefreshCredits}
              onOpenSettings={() => setSettingsOpen(true)}
              isProcessing={isProcessing}
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
            />

            <main className="main-content">
              {activeMode === 'historia' && activeProject && (
                <HistoriasPanel
                  acpStatus={acpStatus}
                  currentModel={currentModel}
                  onProcessingChange={setIsProcessing}
                  activeProject={activeProject}
                  onArtifactSaved={handleArtifactSaved}
                />
              )}
              {activeMode === 'anexo' && activeProject && (
                <DerivationPanel
                  acpStatus={acpStatus}
                  onProcessingChange={setIsProcessing}
                  activeProject={activeProject}
                  onArtifactSaved={handleArtifactSaved}
                  selectedArtifactIds={selectedArtifactIds}
                  artifacts={artifacts}
                />
              )}
              {activeMode === 'validacao' && activeProject && (
                <ReadinessPanel
                  acpStatus={acpStatus}
                  onProcessingChange={setIsProcessing}
                  activeProject={activeProject}
                  onArtifactSaved={handleArtifactSaved}
                  selectedArtifactIds={selectedArtifactIds}
                  artifacts={artifacts}
                />
              )}
              {activeMode === 'artifact' && activeArtifact && (
                activeArtifact.type === 'lacuna' ? (
                  <LacunaView
                    artifact={activeArtifact}
                    acpStatus={acpStatus}
                    onProcessingChange={setIsProcessing}
                    onArtifactSaved={handleArtifactSaved}
                    onDelete={() => handleDeleteArtifact(activeArtifact.id)}
                  />
                ) : (
                  <ArtifactView
                    artifact={activeArtifact}
                    onDelete={() => handleDeleteArtifact(activeArtifact.id)}
                  />
                )
              )}
              {!activeMode && (
                <Welcome
                  acpStatus={acpStatus}
                  hasProject={!!activeProject}
                  projectName={activeProject?.name ?? null}
                  onNewHistoria={activeProject ? () => startMode('historia', activeProject.id) : undefined}
                  onNewAnexo={activeProject ? () => startMode('anexo', activeProject.id) : undefined}
                  onNewValidacao={activeProject ? () => startMode('validacao', activeProject.id) : undefined}
                />
              )}
            </main>

            {/* Chat global — sempre visível, usa artefato ativo + selecionados como contexto */}
            <GlobalChatPanel
              acpStatus={acpStatus}
              width={chatPanelWidth}
              onWidthChange={setChatPanelWidth}
              activeArtifact={activeArtifact}
              selectedArtifacts={selectedArtifacts}
              onProcessingChange={setIsProcessing}
              activeProject={activeProject}
            />
          </>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {toast && (
        <div className={`app-toast${toast.ok ? '' : ' app-toast-error'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Welcome / tela central ────────────────────────────────────────

function Welcome({
  acpStatus,
  hasProject,
  projectName,
  onNewHistoria,
  onNewAnexo,
  onNewValidacao,
}: {
  acpStatus: string
  hasProject: boolean
  projectName: string | null
  onNewHistoria?: () => void
  onNewAnexo?: () => void
  onNewValidacao?: () => void
}) {
  return (
    <div className="welcome">
      <div className="welcome-icon">📋</div>
      <div className="welcome-title">Assistente de Requisitos</div>
      <div className="welcome-sub">Criação, derivação e validação de histórias de usuário</div>

      {acpStatus !== 'ready' && (
        <div className={`welcome-status ${acpStatus}`}>
          {acpStatus === 'connecting' && <><span className="spin-icon">⟳</span> Conectando ao kiro-cli…</>}
          {acpStatus === 'error' && <>Não foi possível conectar ao kiro-cli.</>}
          {acpStatus === 'disconnected' && <>Aguardando kiro-cli…</>}
        </div>
      )}

      {acpStatus === 'ready' && !hasProject && (
        <div className="welcome-hint">Selecione ou crie um projeto na barra lateral para começar.</div>
      )}

      {acpStatus === 'ready' && hasProject && (
        <div className="welcome-actions">
          <p className="welcome-hint">Projeto: <strong>{projectName}</strong></p>
          <div className="welcome-action-btns">
            {onNewHistoria && (
              <button className="welcome-action-btn" onClick={onNewHistoria}>
                📄 Criar Histórias
              </button>
            )}
            {onNewAnexo && (
              <button className="welcome-action-btn" onClick={onNewAnexo}>
                📋 Gerar Anexo Técnico
              </button>
            )}
            {onNewValidacao && (
              <button className="welcome-action-btn" onClick={onNewValidacao}>
                ✅ Validar História (DoR)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
