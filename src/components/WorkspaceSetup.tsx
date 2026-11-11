import React from 'react'

interface WorkspaceSetupProps {
  onConfirm: (path: string) => void
}

export default function WorkspaceSetup({ onConfirm }: WorkspaceSetupProps) {
  const handlePick = async () => {
    const p = await window.electronAPI?.workspacePickFolder()
    if (p) onConfirm(p)
  }

  return (
    <div className="workspace-setup">
      <div className="workspace-setup-box">
        <div className="workspace-setup-icon">📁</div>
        <h2 className="workspace-setup-title">Configurar Workspace</h2>
        <p className="workspace-setup-desc">
          Selecione a pasta raiz onde ficam os projetos de requisitos.
          <br />
          Dentro dela, cada subpasta será um projeto.
        </p>
        <button className="workspace-setup-btn" onClick={handlePick}>
          Selecionar pasta do workspace
        </button>
      </div>
    </div>
  )
}
