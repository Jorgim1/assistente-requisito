import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { autoUpdater } from 'electron-updater'
import { HeadlessClient } from './headless-client.js'
import { readConfig, writeConfig } from './config.js'
import {
  getWorkspacePath, setWorkspacePath,
  listProjects, createProject, initializeProject, deleteProject, listProjectSubfolders,
  listArtifacts, syncProjectArtifacts, createArtifact, readArtifactContent, updateArtifact, deleteArtifact, renameArtifact,
  updateProjectGitlab,
} from './projects.js'
import { listWikiPages, getWikiPage, createWikiPage, updateWikiPage } from './gitlab.js'
import type { ArtifactType } from './projects.js'
import { lerPlanilha, exportarExcel, listSheets } from './extraction/excel.js'
import { REGRAS_EXTRACAO, FORMATO_HISTORIAS, DIRETRIZES_GFO_TJ, DIRETRIZES_SIMADE, SKILL_EXTRAIR, SKILL_REFINAR, EXEMPLO_GRANULARIDADE } from './extraction/content.js'
import { READINESS_PRINCIPIOS, READINESS_REGRAS, READINESS_FORMATO, READINESS_SKILL, READINESS_CRITERIOS, READINESS_AI_READY } from './readiness/content.js'
import { DERIVATION_SKILL_LACUNAS, DERIVATION_SKILL_ANEXO, DERIVATION_HTML_GUIDE, DERIVATION_HTML_TEMPLATE } from './derivation/content.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEV_URL = process.env['VITE_DEV_SERVER_URL']

// ── Proxy configurável ────────────────────────────────────────────
async function applyProxy(proxyUrl?: string) {
  if (proxyUrl) {
    process.env.HTTP_PROXY  = proxyUrl
    process.env.HTTPS_PROXY = proxyUrl
    process.env.http_proxy  = proxyUrl
    process.env.https_proxy = proxyUrl
    await session.defaultSession.setProxy({ proxyRules: proxyUrl })
  } else {
    delete process.env.HTTP_PROXY
    delete process.env.HTTPS_PROXY
    delete process.env.http_proxy
    delete process.env.https_proxy
    await session.defaultSession.setProxy({ proxyRules: '' })
  }
}

// ── Per-window clients ────────────────────────────────────────────
const clients = new Map<number, HeadlessClient>()

function clientFor(event: { sender: Electron.WebContents }): HeadlessClient | undefined {
  return clients.get(event.sender.id)
}

// ── Janela ────────────────────────────────────────────────────────
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#ffffff',
    show: false,
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const client = new HeadlessClient()
  const wcId = win.webContents.id
  clients.set(wcId, client)

  const send = (ch: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(ch, ...args)
  }

  win.once('ready-to-show', async () => {
    const cfg = await readConfig()
    win.show()
    if (cfg.selectedModel) client.currentModel = cfg.selectedModel
    const workspacePath = await getWorkspacePath()
    if (workspacePath) client.connect(workspacePath, cfg.kiroApiKey)
  })

  win.on('closed', () => {
    clients.get(wcId)?.disconnect()
    clients.delete(wcId)
  })

  // Repassa eventos do client para o renderer desta janela
  client.on('acp-status',     (s: string)  => send('acp:status',     s))
  client.on('acp-update',     (u: unknown) => send('acp:update',     u))
  client.on('acp-error',      (m: string)  => send('acp:error',      m))
  client.on('acp-usage',      (u: unknown) => send('acp:usage',      u))
  client.on('acp-context',    (p: number)  => send('acp:context',    p))
  client.on('acp-credits',    (t: string)  => send('acp:credits',    t))
  client.on('acp-whoami',     (i: unknown) => send('acp:whoami',     i))
  client.on('acp-session-id', (k: string)  => send('acp:session-id', k))
  client.on('log',            (e: unknown) => send('app:log',        e))

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '../dist/index.html'))

  return win
}

// ── Auto-update ───────────────────────────────────────────────────
async function setupAutoUpdater() {
  if (DEV_URL) return // só em produção

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:update-available', info)
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:download-progress', { percent: Math.round(progress.percent) })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:update-downloaded', info)
    }
  })

  autoUpdater.on('error', (err) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:update-error', err?.message ?? 'Erro desconhecido')
    }
  })

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('app:update-error', err?.message ?? 'Falha ao verificar atualização')
    }
  })
}

ipcMain.handle('app:version', () => app.getVersion())

ipcMain.handle('app:check-for-updates', async () => {
  if (DEV_URL) return { version: null, currentVersion: app.getVersion(), devMode: true }
  try {
    const result = await autoUpdater.checkForUpdates()
    const latest = result?.updateInfo?.version ?? null
    const current = app.getVersion()
    const hasUpdate = !!latest && latest !== current
    return { version: hasUpdate ? latest : null, currentVersion: current }
  } catch {
    return { error: true, currentVersion: app.getVersion() }
  }
})

// ── Controles de janela ───────────────────────────────────────────
ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
ipcMain.on('win:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
ipcMain.handle('win:new-window', () => { createWindow() })

// ── Headless client via IPC ───────────────────────────────────────
ipcMain.on('acp:connect', async (e, cwd: string) => {
  const cfg = await readConfig()
  if (cwd) clientFor(e)?.connect(cwd, cfg.kiroApiKey)
})
ipcMain.on('acp:prompt',        (e, text: string) => clientFor(e)?.sendPrompt(text))
ipcMain.on('acp:cancel',           (e) => clientFor(e)?.cancel())
ipcMain.on('acp:reset-session',    (e) => clientFor(e)?.resetKiroSession())
ipcMain.on('acp:restore-session',  (e, kiroSessionId: string | null) => clientFor(e)?.setKiroSession(kiroSessionId))
ipcMain.handle('acp:get-cwd',   (e) => clientFor(e)?.getCwd())
ipcMain.on('acp:set-cwd', (e, cwd: string) => {
  clientFor(e)?.setCwd(cwd)
  e.sender.send('acp:cwd', cwd)
})
ipcMain.handle('dialog:pick-folder', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta do projeto',
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})
ipcMain.handle('acp:refresh-usage', async (e) => {
  const client = clientFor(e)
  if (!client) return
  const text = await client.fetchUsage()
  if (text) e.sender.send('acp:credits', text)
  return text
})

// Instala update quando renderer confirma
ipcMain.on('app:install-update', () => autoUpdater.quitAndInstall())

// ── Workspace via IPC ─────────────────────────────────────────────
ipcMain.handle('workspace:get', () => getWorkspacePath())
ipcMain.handle('workspace:set', (_, p: string) => setWorkspacePath(p))
ipcMain.handle('workspace:pick-folder', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta do workspace (raiz dos projetos)',
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

// ── Projetos via IPC ──────────────────────────────────────────────
ipcMain.handle('projects:list', async () => {
  const wp = await getWorkspacePath()
  if (!wp) return []
  return listProjects(wp)
})
ipcMain.handle('projects:create', async (_, name: string, gitlabProjectPath?: string) => {
  const wp = await getWorkspacePath()
  if (!wp) throw new Error('Workspace não definido')
  return createProject(name, wp, gitlabProjectPath)
})
ipcMain.handle('projects:delete',      (_, id: string, projectPath: string) => deleteProject(id, projectPath))
ipcMain.handle('projects:initialize',  (_, folderPath: string, gitlabProjectPath?: string) => initializeProject(folderPath, undefined, gitlabProjectPath))
ipcMain.handle('projects:subfolders',  (_, projectPath: string) => listProjectSubfolders(projectPath))
ipcMain.handle('projects:update-gitlab', (_, projectPath: string, gitlabProjectPath: string) => updateProjectGitlab(projectPath, gitlabProjectPath))

// ── Artefatos via IPC ─────────────────────────────────────────────
ipcMain.handle('artifacts:list',   (_, projectId: string, projectPath: string) => syncProjectArtifacts(projectId, projectPath))
ipcMain.handle('artifacts:read',   (_, id: string) => readArtifactContent(id))
ipcMain.handle('artifacts:update', (_, id: string, content: string) => updateArtifact(id, content))
ipcMain.handle('artifacts:delete', (_, id: string) => deleteArtifact(id))
ipcMain.handle('artifacts:rename', (_, id: string, newTitle: string) => renameArtifact(id, newTitle))
ipcMain.handle('artifacts:create', (
  _,
  projectId: string,
  type: ArtifactType,
  title: string,
  content: string,
  projectFolderPath: string,
) => createArtifact(projectId, type, title, content, projectFolderPath))

// ── Models via IPC ────────────────────────────────────────────────
ipcMain.handle('models:list', (e) => clientFor(e)?.fetchModels())
ipcMain.handle('models:get',  (e) => clientFor(e)?.currentModel)
ipcMain.handle('models:set',  async (e, modelId: string) => {
  const client = clientFor(e)
  if (!client) return
  client.currentModel = modelId
  client.resetKiroSession()
  const cfg = await readConfig()
  await writeConfig({ ...cfg, selectedModel: modelId })
})

// ── Config via IPC ────────────────────────────────────────────────
ipcMain.handle('config:get', () => readConfig())
ipcMain.handle('config:set', async (_, cfg: { kiroApiKey?: string; proxyUrl?: string; gitlabApiUrl?: string; gitlabToken?: string }) => {
  await writeConfig(cfg)
  await applyProxy(cfg.proxyUrl || undefined)
  for (const client of clients.values()) {
    client.disconnect()
    const cwd = client.getCwd()
    if (cwd) client.connect(cwd, cfg.kiroApiKey)
  }
})

// ── GitLab via IPC ────────────────────────────────────────────────
async function getGitlabConfig() {
  const cfg = await readConfig()
  if (!cfg.gitlabApiUrl || !cfg.gitlabToken) throw new Error('GitLab não configurado. Configure a URL da API e o token nas Configurações.')
  return { apiUrl: cfg.gitlabApiUrl, token: cfg.gitlabToken }
}

ipcMain.handle('gitlab:wiki-list', async (_, projectPath: string) => {
  const cfg = await getGitlabConfig()
  return listWikiPages(cfg, projectPath)
})

ipcMain.handle('gitlab:wiki-get', async (_, projectPath: string, slug: string) => {
  const cfg = await getGitlabConfig()
  return getWikiPage(cfg, projectPath, slug)
})

ipcMain.handle('gitlab:wiki-create', async (_, projectPath: string, title: string, content: string) => {
  const cfg = await getGitlabConfig()
  return createWikiPage(cfg, projectPath, title, content)
})

ipcMain.handle('gitlab:wiki-update', async (_, projectPath: string, slug: string, content: string, title?: string) => {
  const cfg = await getGitlabConfig()
  return updateWikiPage(cfg, projectPath, slug, content, title)
})

// ── Filesystem via IPC ────────────────────────────────────────────
ipcMain.handle('fs:list-files', async (_, dir: string) => {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, isDirectory: e.isDirectory(), path: path.join(dir, e.name) }))
      .sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1))
  } catch { return [] }
})
ipcMain.handle('fs:read-file', async (_, filePath: string) => {
  try {
    const stat = await fs.promises.stat(filePath)
    if (stat.size > 80 * 1024) return null
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch { return null }
})

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'release', '.kiro', '__pycache__', '.venv', 'venv'])

async function searchFilesRecursive(dir: string, query: string, results: { name: string; path: string }[], limit = 40) {
  if (results.length >= limit) return
  let entries: fs.Dirent[]
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (results.length >= limit) return
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) await searchFilesRecursive(path.join(dir, e.name), query, results, limit)
    } else {
      if (!query || e.name.toLowerCase().includes(query.toLowerCase()))
        results.push({ name: e.name, path: path.join(dir, e.name) })
    }
  }
}

ipcMain.handle('fs:search-files', async (_, dir: string, query: string) => {
  const results: { name: string; path: string }[] = []
  await searchFilesRecursive(dir, query, results)
  return results
})

ipcMain.handle('dialog:pick-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
  if (canceled) return []
  return filePaths
})

// ── MCP via IPC ───────────────────────────────────────────────────
ipcMain.handle('mcp:get', async (e) => {
  const cwd = clientFor(e)?.getCwd() || process.cwd()
  const p = path.join(cwd, '.kiro', 'settings', 'mcp.json')
  try { return JSON.parse(await fs.promises.readFile(p, 'utf-8')) } catch { return { mcpServers: {} } }
})
ipcMain.handle('mcp:set', async (e, config: unknown) => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const dir = path.join(cwd, '.kiro', 'settings')
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(path.join(dir, 'mcp.json'), JSON.stringify(config, null, 2))
  client?.resetKiroSession()
})

// ── Extrator via IPC ──────────────────────────────────────────────

/** Copia steering files para .kiro/steering/ do projeto ativo */
const LOG_MODEL_LABELS: Record<string, string> = { 'padrao': 'Padrão', 'gfo-tj': 'GFO + TJ', 'simade': 'SIMADE' }

function log(prefix: string, sender: Electron.WebContents, level: 'info' | 'error' | 'raw', message: string) {
  sender.send('app:log', { level, message: `[${prefix}] ${message}` })
}

ipcMain.handle('extrator:activate', async (e, model: 'padrao' | 'gfo-tj' | 'simade') => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const steeringDir = path.join(cwd, '.kiro', 'steering')
  const modelLabel = LOG_MODEL_LABELS[model] ?? model

  log('Extrator', e.sender, 'info', `Ativando skill extrair-historias — modelo: ${modelLabel}`)
  log('Extrator', e.sender, 'info', `Diretório de steering: ${steeringDir}`)

  await fs.promises.mkdir(steeringDir, { recursive: true })

  // Auto — sempre ativos
  await fs.promises.writeFile(path.join(steeringDir, 'extrator-regras.md'),        REGRAS_EXTRACAO)
  await fs.promises.writeFile(path.join(steeringDir, 'extrator-formato.md'),       FORMATO_HISTORIAS)
  await fs.promises.writeFile(path.join(steeringDir, 'extrator-skill-extrair.md'), SKILL_EXTRAIR)
  await fs.promises.writeFile(path.join(steeringDir, 'extrator-skill-refinar.md'), SKILL_REFINAR)
  await fs.promises.writeFile(path.join(steeringDir, 'extrator-exemplos.md'),      EXEMPLO_GRANULARIDADE)
  log('Extrator', e.sender, 'raw', '  → extrator-regras.md          (regras de granularidade e classificação HU/HT/HM)')
  log('Extrator', e.sender, 'raw', '  → extrator-formato.md         (formato de saída Markdown)')
  log('Extrator', e.sender, 'raw', '  → extrator-skill-extrair.md   (processo de 10 passos — skill extrair-historias)')
  log('Extrator', e.sender, 'raw', '  → extrator-skill-refinar.md   (processo de refinamento INVEST + BDD)')
  log('Extrator', e.sender, 'raw', '  → extrator-exemplos.md        (exemplos de granularidade CRUD)')

  // Manual — apenas o modelo escolhido
  if (model === 'gfo-tj') {
    await fs.promises.writeFile(path.join(steeringDir, 'extrator-modelo.md'), DIRETRIZES_GFO_TJ)
    log('Extrator', e.sender, 'raw', '  → extrator-modelo.md    (diretrizes GFO + TJ — linguagem de negócio para PO)')
  } else if (model === 'simade') {
    await fs.promises.writeFile(path.join(steeringDir, 'extrator-modelo.md'), DIRETRIZES_SIMADE)
    log('Extrator', e.sender, 'raw', '  → extrator-modelo.md    (diretrizes SIMADE — personas SSC + sub-numeração)')
  } else {
    try { await fs.promises.unlink(path.join(steeringDir, 'extrator-modelo.md')) } catch { /* ok */ }
    log('Extrator', e.sender, 'raw', '  (sem arquivo de modelo específico — usando narrativa Padrão)')
  }

  log('Extrator', e.sender, 'info', 'Reiniciando sessão kiro-cli para carregar steering files...')
  client?.resetKiroSession()
  log('Extrator', e.sender, 'info', 'Extrator pronto. Skill extrair-historias ativa.')
})

/** Remove steering files do extrator e reseta sessão */
ipcMain.handle('extrator:deactivate', async (e) => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const steeringDir = path.join(cwd, '.kiro', 'steering')
  const filesToRemove = [
    'extrator-regras.md', 'extrator-formato.md', 'extrator-modelo.md',
    'extrator-skill-extrair.md', 'extrator-skill-refinar.md', 'extrator-exemplos.md',
  ]
  for (const fname of filesToRemove) {
    try { await fs.promises.unlink(path.join(steeringDir, fname)) } catch { /* ok */ }
  }
  log('Extrator', e.sender, 'info', 'Extrator desativado. Steering files removidos.')
  client?.resetKiroSession()
})

/** Abre dialog para selecionar planilha Excel */
ipcMain.handle('extrator:pick-excel', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    title: 'Selecionar planilha de visão geral',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

/** Abre seletor de arquivo de demanda (Excel, texto, Markdown, Word) */
ipcMain.handle('extrator:pick-demand-file', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    title: 'Selecionar arquivo de demanda',
    filters: [
      { name: 'Todos os suportados', extensions: ['xlsx', 'xls', 'txt', 'md'] },
      { name: 'Excel', extensions: ['xlsx', 'xls'] },
      { name: 'Texto / Markdown', extensions: ['txt', 'md'] },
    ],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

/** Lista as abas disponíveis em uma planilha Excel */
ipcMain.handle('extrator:list-sheets', async (e, filePath: string) => {
  try {
    return await listSheets(filePath)
  } catch (err) {
    log('Extrator', e.sender, 'error', `Falha ao listar abas: ${err}`)
    return []
  }
})

/** Lê planilha Excel e retorna texto estruturado para o agente */
ipcMain.handle('extrator:read-excel', async (e, filePath: string, selectedSheets?: string[]) => {
  const fileName = path.basename(filePath)
  log('Extrator', e.sender, 'info', `Lendo planilha: ${fileName}`)
  try {
    const content = await lerPlanilha(filePath, selectedSheets)
    const lines = content.split('\n').length
    log('Extrator', e.sender, 'raw', `  → ${lines} linhas extraídas de ${fileName}`)
    return content
  } catch (err) {
    log('Extrator', e.sender, 'error', `Falha ao ler planilha ${fileName}: ${err}`)
    return null
  }
})

/** Salva conteúdo markdown em arquivo */
ipcMain.handle('extrator:export-md', async (e, content: string) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar histórias como Markdown',
    defaultPath: 'historias.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return false
  await fs.promises.mkdir(path.dirname(result.filePath), { recursive: true })
  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  log('Extrator', e.sender, 'info', `Histórias exportadas: ${result.filePath}`)
  return true
})

/** Converte markdown de HU/HT para Excel estilizado */
ipcMain.handle('extrator:export-xlsx', async (e, content: string) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar histórias como Excel',
    defaultPath: 'historias.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (result.canceled || !result.filePath) return false
  log('Extrator', e.sender, 'info', `Gerando planilha Excel: ${path.basename(result.filePath)}`)
  try {
    await exportarExcel(content, result.filePath)
    log('Extrator', e.sender, 'info', `Planilha salva: ${result.filePath}`)
    return true
  } catch (err) {
    log('Extrator', e.sender, 'error', `Falha ao gerar Excel: ${err}`)
    return false
  }
})

// ── Readiness via IPC ────────────────────────────────────────────


ipcMain.handle('readiness:activate', async (e, model: 'padrao' | 'gfo') => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const steeringDir = path.join(cwd, '.kiro', 'steering')
  log('Readiness', e.sender, 'info', `Ativando Validador DoR — modelo: ${model}`)
  await fs.promises.mkdir(steeringDir, { recursive: true })
  await fs.promises.writeFile(path.join(steeringDir, 'readiness-principios.md'),  READINESS_PRINCIPIOS)
  await fs.promises.writeFile(path.join(steeringDir, 'readiness-regras.md'),      READINESS_REGRAS)
  await fs.promises.writeFile(path.join(steeringDir, 'readiness-formato.md'),     READINESS_FORMATO)
  await fs.promises.writeFile(path.join(steeringDir, 'readiness-skill.md'),       READINESS_SKILL)
  await fs.promises.writeFile(path.join(steeringDir, 'readiness-criterios.md'),   READINESS_CRITERIOS)
  await fs.promises.writeFile(path.join(steeringDir, 'readiness-ai-ready.md'),    READINESS_AI_READY)
  if (model === 'gfo') {
    await fs.promises.writeFile(path.join(steeringDir, 'readiness-modelo.md'),
      '# Modelo de Labels: GFO\nUse as labels e status do modelo GFO ao preencher a seção 15 do relatório.')
  } else {
    try { await fs.promises.unlink(path.join(steeringDir, 'readiness-modelo.md')) } catch { /* ok */ }
  }
  log('Readiness', e.sender, 'info', 'Steering files escritos. Reiniciando sessão kiro-cli...')
  client?.resetKiroSession()
  log('Readiness', e.sender, 'info', 'Validador DoR pronto.')
})

ipcMain.handle('readiness:deactivate', async (e) => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const steeringDir = path.join(cwd, '.kiro', 'steering')
  const files = [
    'readiness-principios.md', 'readiness-regras.md', 'readiness-formato.md',
    'readiness-skill.md', 'readiness-criterios.md', 'readiness-ai-ready.md', 'readiness-modelo.md',
  ]
  for (const f of files) {
    try { await fs.promises.unlink(path.join(steeringDir, f)) } catch { /* ok */ }
  }
  log('Readiness', e.sender, 'info', 'Steering files removidos. Sessão reiniciada.')
  client?.resetKiroSession()
})

ipcMain.handle('readiness:export-md', async (e, content: string) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar relatório DoR como Markdown',
    defaultPath: 'relatorio-dor.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return false
  await fs.promises.mkdir(path.dirname(result.filePath), { recursive: true })
  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  log('Readiness', e.sender, 'info', `Relatório exportado: ${result.filePath}`)
  return true
})

// ── Derivação via IPC ────────────────────────────────────────────

ipcMain.handle('derivation:activate', async (e, phase: 'lacunas' | 'anexo' | 'html') => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const steeringDir = path.join(cwd, '.kiro', 'steering')
  log('Derivação', e.sender, 'info', `Ativando fase: ${phase}`)
  await fs.promises.mkdir(steeringDir, { recursive: true })

  if (phase === 'lacunas') {
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-anexo-skill.md')) } catch { /* ok */ }
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-html-guide.md')) } catch { /* ok */ }
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-html-template.html')) } catch { /* ok */ }
    await fs.promises.writeFile(path.join(steeringDir, 'derivation-lacunas-skill.md'), DERIVATION_SKILL_LACUNAS)
    log('Derivação', e.sender, 'raw', '  → derivation-lacunas-skill.md (levantar lacunas técnicas da HU)')
  } else if (phase === 'anexo') {
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-lacunas-skill.md')) } catch { /* ok */ }
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-html-guide.md')) } catch { /* ok */ }
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-html-template.html')) } catch { /* ok */ }
    await fs.promises.writeFile(path.join(steeringDir, 'derivation-anexo-skill.md'), DERIVATION_SKILL_ANEXO)
    log('Derivação', e.sender, 'raw', '  → derivation-anexo-skill.md   (derivar Anexo Técnico completo)')
  } else {
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-lacunas-skill.md')) } catch { /* ok */ }
    try { await fs.promises.unlink(path.join(steeringDir, 'derivation-anexo-skill.md')) } catch { /* ok */ }
    await fs.promises.writeFile(path.join(steeringDir, 'derivation-html-guide.md'),         DERIVATION_HTML_GUIDE)
    await fs.promises.writeFile(path.join(steeringDir, 'derivation-html-template.html'),    DERIVATION_HTML_TEMPLATE)
    log('Derivação', e.sender, 'raw', '  → derivation-html-guide.md     (diretrizes de geração HTML)')
    log('Derivação', e.sender, 'raw', '  → derivation-html-template.html (template Prodemge)')
  }

  log('Derivação', e.sender, 'info', 'Reiniciando sessão kiro-cli...')
  client?.resetKiroSession()
  log('Derivação', e.sender, 'info', `Fase ${phase} pronta.`)
})

ipcMain.handle('derivation:deactivate', async (e) => {
  const client = clientFor(e)
  const cwd = client?.getCwd() || process.cwd()
  const steeringDir = path.join(cwd, '.kiro', 'steering')
  const files = [
    'derivation-lacunas-skill.md',
    'derivation-anexo-skill.md',
    'derivation-html-guide.md',
    'derivation-html-template.html',
  ]
  for (const f of files) {
    try { await fs.promises.unlink(path.join(steeringDir, f)) } catch { /* ok */ }
  }
  log('Derivação', e.sender, 'info', 'Steering files removidos. Sessão reiniciada.')
  client?.resetKiroSession()
})

ipcMain.handle('derivation:export-md', async (e, content: string) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar Anexo Técnico como Markdown',
    defaultPath: 'anexo-tecnico.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return false
  await fs.promises.mkdir(path.dirname(result.filePath), { recursive: true })
  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  log('Derivação', e.sender, 'info', `Anexo Técnico exportado: ${result.filePath}`)
  return true
})

ipcMain.handle('derivation:export-html', async (e, content: string) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return false
  const result = await dialog.showSaveDialog(win, {
    title: 'Salvar Anexo Técnico como HTML',
    defaultPath: 'anexo-tecnico.html',
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })
  if (result.canceled || !result.filePath) return false
  await fs.promises.mkdir(path.dirname(result.filePath), { recursive: true })
  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  log('Derivação', e.sender, 'info', `HTML exportado: ${result.filePath}`)
  return true
})

// ── Ciclo de vida ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  const cfg = await readConfig()
  await applyProxy(cfg.proxyUrl)
  createWindow()
  await setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
