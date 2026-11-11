export type UnsubFn = () => void

export type ArtifactType = 'historia' | 'anexo' | 'validacao' | 'lacuna'

export interface Project {
  id: string
  name: string
  path: string
  createdAt: number
  updatedAt: number
  isProject: boolean
  gitlabProjectPath?: string
}

export interface WikiPage {
  slug: string
  title: string
  format: string
  content?: string
}

export interface Artifact {
  id: string
  projectId: string
  type: ArtifactType
  title: string
  filePath: string
  createdAt: number
  updatedAt: number
}

export interface KiroModel {
  model_id:              string
  model_name:            string
  description:           string
  rate_multiplier:       number
  rate_unit:             string
  context_window_tokens: number
}

export interface AgentUpdate {
  type: 'AgentMessageChunk' | 'ToolCallStart' | 'ToolCallEnd' | 'TurnEnd'
  content?: string
  toolName?: string
  toolId?: string
  args?: unknown
  status?: 'success' | 'error'
  output?: string
  model?: string
  credits?: number
}

export interface TokenUsage {
  inputTokens:  number
  outputTokens: number
  credits?:     number
}

export interface LogEntry {
  level: 'info' | 'error' | 'raw'
  message: string
}

export interface FileEntry { name: string; isDirectory: boolean; path: string }

export interface ElectronAPI {
  // Janela
  minimize:      () => void
  maximize:      () => void
  close:         () => void
  openNewWindow: () => void

  // Headless client — comandos
  connectAcp:         (cwd: string) => void
  sendPrompt:         (text: string) => void
  cancelAcp:          () => void
  resetKiroSession:   () => void
  acpRestoreSession:  (kiroSessionId: string | null) => void
  getCwd:      () => Promise<string>
  setCwd:      (cwd: string) => void
  pickFolder:  () => Promise<string | null>
  onCwdChange: (cb: (cwd: string) => void) => UnsubFn

  // Headless client — eventos
  onAcpStatus:    (cb: (status: string) => void) => UnsubFn
  onAcpUpdate:    (cb: (update: AgentUpdate) => void) => UnsubFn
  onAcpError:     (cb: (msg: string) => void) => UnsubFn
  onAcpUsage:     (cb: (usage: TokenUsage) => void) => UnsubFn
  onAcpCredits:   (cb: (text: string) => void) => UnsubFn
  onAcpWhoami:    (cb: (info: { email: string }) => void) => UnsubFn
  onContextUsage: (cb: (pct: number) => void) => UnsubFn
  onAcpSessionId: (cb: (kiroSessionId: string) => void) => UnsubFn
  refreshUsage:   () => Promise<string>

  // Workspace
  workspaceGet:        () => Promise<string | null>
  workspaceSet:        (p: string) => Promise<void>
  workspacePickFolder: () => Promise<string | null>

  // Projetos
  projectsList:   () => Promise<Project[]>
  projectsCreate: (name: string, gitlabProjectPath?: string) => Promise<Project>
  projectsDelete:       (id: string, projectPath: string) => Promise<void>
  projectsInitialize:   (folderPath: string, gitlabProjectPath?: string) => Promise<Project>
  projectsSubfolders:   (projectPath: string) => Promise<string[]>
  projectsUpdateGitlab: (projectPath: string, gitlabProjectPath: string) => Promise<void>

  // Artefatos
  artifactsList:   (projectId: string, projectPath: string) => Promise<Artifact[]>
  artifactsRead:   (id: string) => Promise<string | null>
  artifactsCreate: (projectId: string, type: ArtifactType, title: string, content: string, projectFolderPath: string) => Promise<Artifact>
  artifactsUpdate: (id: string, content: string) => Promise<boolean>
  artifactsDelete: (id: string) => Promise<void>
  artifactsRename: (id: string, newTitle: string) => Promise<Artifact | null>

  // Models
  listModels: () => Promise<KiroModel[]>
  getModel:   () => Promise<string>
  setModel:   (modelId: string) => Promise<void>

  // Config
  getConfig:  () => Promise<{ kiroApiKey?: string; proxyUrl?: string; gitlabApiUrl?: string; gitlabToken?: string }>
  setConfig:  (cfg: { kiroApiKey?: string; proxyUrl?: string; gitlabApiUrl?: string; gitlabToken?: string }) => Promise<void>

  // GitLab
  gitlab: {
    wikiList:   (projectPath: string) => Promise<WikiPage[]>
    wikiGet:    (projectPath: string, slug: string) => Promise<WikiPage>
    wikiCreate: (projectPath: string, title: string, content: string) => Promise<WikiPage>
    wikiUpdate: (projectPath: string, slug: string, content: string, title?: string) => Promise<WikiPage>
  }

  // Filesystem
  listFiles:   (dir: string) => Promise<FileEntry[]>
  readFile:    (path: string) => Promise<string | null>
  searchFiles: (dir: string, query: string) => Promise<{ name: string; path: string }[]>
  pickFiles:   () => Promise<string[]>

  // MCP
  getMcpConfig: () => Promise<{ mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string,string> }> }>
  setMcpConfig: (cfg: { mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string,string> }> }) => Promise<void>

  // Log
  onLog: (cb: (entry: LogEntry) => void) => UnsubFn

  // Auto-update
  onUpdateAvailable:  (cb: (info: unknown) => void) => UnsubFn
  onUpdateDownloaded: (cb: (info: unknown) => void) => UnsubFn
  onDownloadProgress: (cb: (data: { percent: number }) => void) => UnsubFn
  onUpdateError:      (cb: (msg: string) => void) => UnsubFn
  installUpdate:   () => void
  getAppVersion:   () => Promise<string>
  checkForUpdates: () => Promise<{ version?: string | null; currentVersion?: string; error?: boolean; devMode?: boolean }>

  // Readiness
  readiness: {
    activate:   (model: 'padrao' | 'gfo') => Promise<void>
    deactivate: () => Promise<void>
    exportMd:   (content: string) => Promise<boolean>
  }

  // Extrator
  extrator: {
    activate:    (model: 'padrao' | 'gfo-tj' | 'simade') => Promise<void>
    deactivate:  () => Promise<void>
    pickExcel:       () => Promise<string | null>
    pickDemandFile:  () => Promise<string | null>
    listSheets:  (filePath: string) => Promise<{name: string, rows: number}[]>
    readExcel:   (filePath: string, selectedSheets?: string[]) => Promise<string | null>
    exportMd:    (content: string) => Promise<boolean>
    exportXlsx:  (content: string) => Promise<boolean>
  }

  // Derivação
  derivation: {
    activate:   (phase: 'lacunas' | 'anexo' | 'html') => Promise<void>
    deactivate: () => Promise<void>
    exportMd:   (content: string) => Promise<boolean>
    exportHtml: (content: string) => Promise<boolean>
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
