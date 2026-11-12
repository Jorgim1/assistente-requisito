import React, { useEffect, useState } from 'react'
import type { Artifact } from '../electron'

interface Props {
  gitlabProjectPath: string
  projectId: string
  projectFolderPath: string
  localArtifacts: Artifact[]
  onClose: () => void
  onArtifactSaved: (artifact: Artifact) => void
}

// Tipos de artefato que vão para a wiki (HU por enquanto; HT quando for adicionado)
const WIKI_ARTIFACT_TYPES = ['historia']

interface StatusFile {
  code: string   // 'M', 'D', 'A', '??' etc
  filename: string
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseStatus(raw: string): StatusFile[] {
  return raw.trim().split('\n')
    .filter((l) => l.trim())
    .map((l) => ({ code: l.slice(0, 2).trim(), filename: l.slice(3).trim() }))
}

export default function WikiSyncModal({
  gitlabProjectPath,
  projectId,
  projectFolderPath,
  localArtifacts,
  onClose,
  onArtifactSaved,
}: Props) {
  // Pasta local do clone git da wiki
  const wikiPath = projectFolderPath + '/.wiki'
  // Apenas artefatos dos tipos permitidos (HU, futuramente HT)
  const wikiArtifacts = localArtifacts.filter((a) => WIKI_ARTIFACT_TYPES.includes(a.type))
  const [cloned, setCloned]         = useState<boolean | null>(null)
  const [cloning, setCloning]       = useState(false)
  const [status, setStatus]         = useState('')
  const [statusFiles, setStatusFiles] = useState<StatusFile[]>([])
  const [pages, setPages]           = useState<string[]>([])
  const [log, setLog]               = useState('')
  const [diff, setDiff]             = useState('')
  const [commitMsg, setCommitMsg]   = useState('')
  const [busy, setBusy]             = useState('')
  const [error, setError]           = useState('')
  const [showLog, setShowLog]       = useState(false)
  const [showDiff, setShowDiff]     = useState(false)

  const api = window.electronAPI!

  useEffect(() => { checkCloned() }, [])

  async function checkCloned() {
    setCloned(null)
    setError('')
    try {
      const isCloned = await api.wikiGit.isCloned(projectFolderPath)
      setCloned(isCloned)
      if (isCloned) await loadAll()
    } catch (e) {
      setError((e as Error).message)
      setCloned(false)
    }
  }

  async function loadAll() {
    try {
      const [s, p, l] = await Promise.all([
        api.wikiGit.status(projectFolderPath),
        api.wikiGit.listPages(projectFolderPath),
        api.wikiGit.log(projectFolderPath, 8),
      ])
      setStatus(s)
      setStatusFiles(parseStatus(s))
      setPages(p)
      setLog(l)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleClone() {
    setCloning(true)
    setError('')
    try {
      await api.wikiGit.setup(gitlabProjectPath, projectFolderPath)
      setCloned(true)
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCloning(false)
    }
  }

  async function handlePull() {
    setBusy('pull')
    setError('')
    try {
      await api.wikiGit.pull(projectFolderPath)
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function handlePush() {
    setBusy('push')
    setError('')
    try {
      await api.wikiGit.push(projectFolderPath)
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function handleCommit() {
    if (!commitMsg.trim()) return
    setBusy('commit')
    setError('')
    try {
      await api.wikiGit.commit(projectFolderPath, commitMsg)
      setCommitMsg('')
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function handleCommitAndPush() {
    if (!commitMsg.trim()) return
    setBusy('commit-push')
    setError('')
    try {
      await api.wikiGit.commit(projectFolderPath, commitMsg)
      await api.wikiGit.push(projectFolderPath)
      setCommitMsg('')
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function handleRestore(file?: string) {
    setBusy(file ? `restore-${file}` : 'restore-all')
    setError('')
    try {
      await api.wikiGit.restore(projectFolderPath, file)
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function handleImportPage(filename: string) {
    setBusy(`import-${filename}`)
    setError('')
    try {
      const content = await api.wikiGit.readPage(projectFolderPath, filename)
      const title = filename.replace(/\.md$/, '').replace(/-/g, ' ')
      // Comparação slugificada para tolerar diferenças de acento e case
      const existing = wikiArtifacts.find(
        (a) => slugify(a.title) === slugify(title),
      )
      if (existing) {
        await api.artifactsUpdate(existing.id, content)
        onArtifactSaved({ ...existing })
      } else {
        // Salva o artefato dentro de .wiki/ — mesma pasta do clone git
        const artifact = await api.artifactsCreate(
          projectId, 'historia', title, content, wikiPath,
        )
        onArtifactSaved(artifact)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function handleShowDiff() {
    if (!showDiff) {
      try {
        const d = await api.wikiGit.diff(projectFolderPath)
        setDiff(d || '(nenhuma diferença pendente)')
      } catch (e) {
        setDiff((e as Error).message)
      }
    }
    setShowDiff(!showDiff)
  }

  const isBusy      = !!busy || cloning
  const isDirty     = status.trim().length > 0
  const statusClean = !isDirty

  // ── Render: carregando ──────────────────────────────────────────
  if (cloned === null) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card wiki-git-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">Wiki Git</div>
          <p className="wiki-git-loading">Verificando repositório…</p>
        </div>
      </div>
    )
  }

  // ── Render: setup (não clonado) ─────────────────────────────────
  if (!cloned) {
    return (
      <div className="modal-overlay" onClick={isBusy ? undefined : onClose}>
        <div className="modal-card wiki-git-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">Wiki Git — Configurar</div>
          <p className="wiki-git-project">{gitlabProjectPath}</p>

          <div className="wiki-git-setup">
            <p className="wiki-git-setup-desc">
              Clone o repositório git da wiki para habilitar sincronização completa:
              diff, log, commit, push e pull — e ferramentas MCP para o chat usar.
            </p>
            <ul className="wiki-git-setup-list">
              <li>⬇ Baixar todas as páginas da wiki</li>
              <li>⬆ Enviar alterações locais com commit</li>
              <li>📄 Importar páginas como artefatos</li>
              <li>🤖 IA acessa a wiki via chat (MCP)</li>
            </ul>
            {error && <p className="wiki-git-error">{error}</p>}
            <button
              className="wiki-git-clone-btn"
              onClick={handleClone}
              disabled={isBusy}
            >
              {cloning ? <><span className="spin-icon">⟳</span> Clonando…</> : '🔗 Clonar Wiki'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="modal-btn-cancel" onClick={onClose} disabled={isBusy}>Fechar</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: painel git ──────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={isBusy ? undefined : onClose}>
      <div className="modal-card wiki-git-card wiki-git-card--main" onClick={(e) => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div className="wiki-git-header">
          <div>
            <div className="modal-title" style={{ marginBottom: 2 }}>Wiki Git</div>
            <p className="wiki-git-project">{gitlabProjectPath}</p>
          </div>
          <div className="wiki-git-header-actions">
            <span className={`wiki-git-badge ${statusClean ? 'wiki-git-badge--clean' : 'wiki-git-badge--dirty'}`}>
              {statusClean ? '✅ Limpa' : `⚠ ${status.trim().split('\n').length} mod.`}
            </span>
            <button className="wiki-git-action-btn" onClick={() => loadAll()} disabled={isBusy} title="Atualizar status">
              {busy === '' ? '🔄' : <span className="spin-icon">⟳</span>}
            </button>
          </div>
        </div>

        {error && <p className="wiki-git-error">{error}</p>}

        {/* Ações principais */}
        <div className="wiki-git-actions">
          <button
            className="wiki-git-action-btn wiki-git-action-btn--pull"
            onClick={handlePull}
            disabled={isBusy}
            title="git pull --rebase"
          >
            {busy === 'pull' ? <span className="spin-icon">⟳</span> : '⬇'} Pull
          </button>
          <button
            className="wiki-git-action-btn wiki-git-action-btn--push"
            onClick={handlePush}
            disabled={isBusy || isDirty}
            title={isDirty ? 'Commite as alterações antes de fazer push' : 'git push'}
          >
            {busy === 'push' ? <span className="spin-icon">⟳</span> : '⬆'} Push
          </button>
          <button
            className="wiki-git-action-btn wiki-git-action-btn--log"
            onClick={() => setShowLog(!showLog)}
            title="Histórico de commits"
          >
            📋 Log {showLog ? '▲' : '▼'}
          </button>
          <button
            className="wiki-git-action-btn wiki-git-action-btn--diff"
            onClick={handleShowDiff}
            disabled={isBusy}
            title="Ver diferenças pendentes"
          >
            🔍 Diff {showDiff ? '▲' : '▼'}
          </button>
        </div>

        {/* Log */}
        {showLog && (
          <div className="wiki-git-section">
            <div className="wiki-git-section-title">Histórico</div>
            <pre className="wiki-git-log">{log || '(sem commits)'}</pre>
          </div>
        )}

        {/* Diff */}
        {showDiff && (
          <div className="wiki-git-section">
            <div className="wiki-git-section-title">Diferenças pendentes</div>
            <pre className="wiki-git-diff">{diff}</pre>
          </div>
        )}

        {/* Alterações pendentes */}
        {isDirty && (
          <div className="wiki-git-section">
            <div className="wiki-git-section-title">
              Alterações pendentes
              <button
                className="wiki-git-action-btn wiki-git-action-btn--discard"
                onClick={() => handleRestore()}
                disabled={isBusy}
                title="git restore . && git clean -fd"
              >
                {busy === 'restore-all' ? <span className="spin-icon">⟳</span> : '↩'} Descartar tudo
              </button>
            </div>
            {/* Arquivo por arquivo com código e botão descartar */}
            <div className="wiki-git-status-files">
              {statusFiles.map((sf) => (
                <div key={sf.filename} className="wiki-git-status-file-row">
                  <span className={`wiki-git-status-code wiki-git-code-${sf.code === 'D' ? 'deleted' : sf.code === '??' ? 'untracked' : 'modified'}`}>
                    {sf.code === 'D' ? '✗ deletado' : sf.code === '??' ? '+ novo' : '~ modificado'}
                  </span>
                  <span className="wiki-git-status-fname" title={sf.filename}>
                    {sf.filename.length > 36 ? '…' + sf.filename.slice(-34) : sf.filename}
                  </span>
                  <button
                    className="wiki-git-discard-btn"
                    onClick={() => handleRestore(sf.filename)}
                    disabled={isBusy}
                    title={`git restore -- ${sf.filename}`}
                  >
                    {busy === `restore-${sf.filename}` ? <span className="spin-icon">⟳</span> : '↩'}
                  </button>
                </div>
              ))}
            </div>
            {/* Commit row */}
            <div className="wiki-git-commit-row">
              <input
                className="wiki-git-commit-input"
                placeholder="Mensagem do commit…"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleCommit() }}
                disabled={isBusy}
              />
              <button
                className="wiki-git-action-btn wiki-git-action-btn--commit"
                onClick={handleCommit}
                disabled={isBusy || !commitMsg.trim()}
                title="git add -A && git commit"
              >
                {busy === 'commit' ? <span className="spin-icon">⟳</span> : '✓'} Commit
              </button>
              <button
                className="wiki-git-action-btn wiki-git-action-btn--push"
                onClick={handleCommitAndPush}
                disabled={isBusy || !commitMsg.trim()}
                title="Commit + push"
              >
                {busy === 'commit-push' ? <span className="spin-icon">⟳</span> : '⬆'} Commit+Push
              </button>
            </div>
          </div>
        )}

        {/* Páginas */}
        <div className="wiki-git-section wiki-git-section--pages">
          <div className="wiki-git-section-title">
            Páginas ({pages.length})
            <span className="wiki-git-pages-hint">Arquivos já locais (git) — Registrar cria o artefato no app</span>
          </div>
          {pages.length === 0 ? (
            <p className="wiki-git-empty">Nenhuma página .md encontrada na wiki.</p>
          ) : (
            <div className="wiki-git-pages-list">
              {pages.map((filename) => {
                const title = filename.replace(/\.md$/, '').replace(/-/g, ' ')
                // Usa slugify para tolerar diferenças de acento/hífens entre nome de arquivo e título do artefato
                const hasArtifact = wikiArtifacts.some(
                  (a) => slugify(a.title) === slugify(title),
                )
                return (
                  <div key={filename} className="wiki-git-page-row">
                    <span className="wiki-git-page-name" title={filename}>
                      📄 {title.length > 44 ? title.slice(0, 44) + '…' : title}
                    </span>
                    <span className={`wiki-git-page-badge ${hasArtifact ? 'wiki-git-page-badge--local' : 'wiki-git-page-badge--git'}`}>
                      {hasArtifact ? '✓ artefato' : '↓ git'}
                    </span>
                    <button
                      className="wiki-git-import-btn"
                      onClick={() => handleImportPage(filename)}
                      disabled={isBusy}
                      title={hasArtifact ? 'Atualizar artefato com conteúdo do arquivo local' : 'Registrar arquivo git como artefato no app'}
                    >
                      {busy === `import-${filename}` ? <span className="spin-icon">⟳</span>
                        : hasArtifact ? '↻ Atualizar' : '+ Registrar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Dica do chat */}
        <div className="wiki-git-hint">
          💡 Use o <strong>Chat</strong> para analisar e modificar páginas com IA — o MCP wiki-git está disponível.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="modal-btn-cancel" onClick={onClose} disabled={isBusy}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
