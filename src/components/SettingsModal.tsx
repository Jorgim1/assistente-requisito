import React, { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServer>
}

export default function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<'geral' | 'mcp'>('geral')

  // ── Geral tab state ───────────────────────────────────────────
  const [apiKey, setApiKey] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [gitlabApiUrl, setGitlabApiUrl] = useState('')
  const [gitlabToken, setGitlabToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'uptodate' | 'available' | 'error'>('idle')
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)

  // ── MCP tab state ─────────────────────────────────────────────
  const [mcpConfig, setMcpConfig] = useState<McpConfig>({ mcpServers: {} })
  const [mcpSaving, setMcpSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [newEnv, setNewEnv] = useState('')

  useEffect(() => {
    if (!open) return
    window.electronAPI?.getConfig().then((cfg) => {
      setApiKey(cfg.kiroApiKey ?? '')
      setProxyUrl(cfg.proxyUrl ?? '')
      setGitlabApiUrl(cfg.gitlabApiUrl ?? '')
      setGitlabToken(cfg.gitlabToken ?? '')
    })
    window.electronAPI?.getMcpConfig().then((cfg) => {
      setMcpConfig(cfg ?? { mcpServers: {} })
    })
    window.electronAPI?.getAppVersion().then((v) => setAppVersion(v))
    setUpdateStatus('idle')
    setAvailableVersion(null)
  }, [open])

  if (!open) return null

  // ── Handlers: Geral ───────────────────────────────────────────

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    setUpdateStatus('idle')
    setAvailableVersion(null)
    const result = await window.electronAPI?.checkForUpdates()
    setCheckingUpdate(false)
    if (!result || result.error) { setUpdateStatus('error'); return }
    if (result.version) {
      setAvailableVersion(result.version)
      setUpdateStatus('available')
    } else {
      setUpdateStatus('uptodate')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.electronAPI?.setConfig({
        kiroApiKey: apiKey,
        proxyUrl: proxyUrl.trim() || undefined,
        gitlabApiUrl: gitlabApiUrl.trim() || undefined,
        gitlabToken: gitlabToken.trim() || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // ── Handlers: MCP ─────────────────────────────────────────────

  const handleMcpSave = async () => {
    setMcpSaving(true)
    try {
      await window.electronAPI?.setMcpConfig(mcpConfig)
    } finally {
      setMcpSaving(false)
    }
  }

  const handleAddServer = () => {
    if (!newName.trim() || !newCommand.trim()) return
    const argsArr = newArgs.trim()
      ? newArgs.split(',').map((a) => a.trim()).filter(Boolean)
      : undefined
    const envObj: Record<string, string> = {}
    if (newEnv.trim()) {
      for (const line of newEnv.split('\n')) {
        const [k, ...rest] = line.split('=')
        if (k && rest.length > 0) envObj[k.trim()] = rest.join('=').trim()
      }
    }
    const server: McpServer = {
      command: newCommand.trim(),
      ...(argsArr ? { args: argsArr } : {}),
      ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
    }
    setMcpConfig((prev) => ({
      mcpServers: { ...prev.mcpServers, [newName.trim()]: server },
    }))
    setNewName('')
    setNewCommand('')
    setNewArgs('')
    setNewEnv('')
    setShowAddForm(false)
  }

  const handleDeleteServer = (name: string) => {
    setMcpConfig((prev) => {
      const next = { ...prev.mcpServers }
      delete next[name]
      return { mcpServers: next }
    })
  }

  const serverEntries = Object.entries(mcpConfig.mcpServers)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Configurações</div>

        <div className="modal-tabs">
          <button
            className={`modal-tab${tab === 'geral' ? ' active' : ''}`}
            onClick={() => setTab('geral')}
          >
            Geral
          </button>
          <button
            className={`modal-tab${tab === 'mcp' ? ' active' : ''}`}
            onClick={() => setTab('mcp')}
          >
            MCP Servers
          </button>
        </div>

        {tab === 'geral' && (
          <>
            <div className="modal-label">Chave API do kiro-cli (KIRO_API_KEY)</div>
            <input
              className="modal-input"
              type="password"
              placeholder="Insira a chave API..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
            />
            <p style={{ fontSize: 11, color: 'var(--gray-mute)', margin: '6px 0 20px' }}>
              Obtida em kiro.dev/account. Será salva localmente e passada como KIRO_API_KEY e ANTHROPIC_API_KEY ao kiro-cli.
            </p>

            <div className="modal-label">Proxy HTTP</div>
            <input
              className="modal-input"
              type="text"
              placeholder="http://proxy.exemplo.com:8080  (deixe vazio para não usar)"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
            />
            <p style={{ fontSize: 11, color: 'var(--gray-mute)', margin: '6px 0 20px' }}>
              Usado para downloads de atualização e conexões do kiro-cli. Aplica-se imediatamente ao salvar.
            </p>

            <div className="modal-label">GitLab — URL da API</div>
            <input
              className="modal-input"
              type="text"
              placeholder="https://git.suaempresa.com/api/v4"
              value={gitlabApiUrl}
              onChange={(e) => setGitlabApiUrl(e.target.value)}
            />
            <div className="modal-label" style={{ marginTop: 10 }}>GitLab — Personal Access Token</div>
            <input
              className="modal-input"
              type="password"
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              value={gitlabToken}
              onChange={(e) => setGitlabToken(e.target.value)}
            />
            <p style={{ fontSize: 11, color: 'var(--gray-mute)', margin: '6px 0 20px' }}>
              Usado para importar páginas da wiki e publicar histórias no GitLab. O token precisa de permissão api ou write_repository.
            </p>

            <div className="modal-label" style={{ marginBottom: 6 }}>Atualizações</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--fg)', cursor: checkingUpdate ? 'default' : 'pointer',
                  opacity: checkingUpdate ? 0.6 : 1,
                }}
              >
                {checkingUpdate ? 'Verificando…' : 'Verificar atualizações'}
              </button>
              {appVersion && (
                <span style={{ fontSize: 11, color: 'var(--gray-mute)' }}>v{appVersion}</span>
              )}
            </div>
            <div style={{ minHeight: 18, marginBottom: 16 }}>
              {updateStatus === 'uptodate'  && <span style={{ fontSize: 11, color: 'var(--gray-mute)' }}>✓ App está na versão mais recente</span>}
              {updateStatus === 'available' && <span style={{ fontSize: 11, color: '#0057ad' }}>⬇ Nova versão {availableVersion} disponível — aguarde o download</span>}
              {updateStatus === 'error'     && <span style={{ fontSize: 11, color: '#c0392b' }}>Não foi possível verificar atualizações</span>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="modal-btn-cancel" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button className="modal-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}

        {tab === 'mcp' && (
          <>
            <div className="mcp-server-list">
              {serverEntries.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Nenhum servidor MCP configurado.</p>
              )}
              {serverEntries.map(([name, srv]) => (
                <div key={name} className="mcp-server-row">
                  <span className="mcp-server-name">{name}</span>
                  <span className="mcp-server-cmd">
                    {srv.command}{srv.args ? ' ' + srv.args.join(' ') : ''}
                  </span>
                  <button
                    className="mcp-server-del"
                    onClick={() => handleDeleteServer(name)}
                    title="Remover servidor"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {showAddForm && (
              <div className="mcp-add-form">
                <input
                  placeholder="Nome do servidor (ex: my-server)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <input
                  placeholder="Comando (ex: npx, python, /usr/bin/node)"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                />
                <input
                  placeholder="Args separados por vírgula (ex: -y, mcp-server-fetch)"
                  value={newArgs}
                  onChange={(e) => setNewArgs(e.target.value)}
                />
                <input
                  placeholder="Variáveis de ambiente: KEY=VALUE (uma por linha)"
                  value={newEnv}
                  onChange={(e) => setNewEnv(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="modal-btn-cancel" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </button>
                  <button
                    className="modal-btn-save"
                    onClick={handleAddServer}
                    disabled={!newName.trim() || !newCommand.trim()}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {!showAddForm && (
              <button
                className="modal-btn-save"
                style={{ marginBottom: 12 }}
                onClick={() => setShowAddForm(true)}
              >
                + Adicionar servidor MCP
              </button>
            )}

            <p style={{ fontSize: 11, color: 'var(--gray-mute)', marginBottom: 14 }}>
              Salvo em .kiro/settings/mcp.json no diretório do projeto. Reiniciar a conversa para aplicar.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="modal-btn-cancel" onClick={onClose} disabled={mcpSaving}>
                Cancelar
              </button>
              <button className="modal-btn-save" onClick={handleMcpSave} disabled={mcpSaving}>
                {mcpSaving ? 'Salvando…' : 'Salvar MCP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
