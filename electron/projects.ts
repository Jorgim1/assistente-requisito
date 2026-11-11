import fs from 'fs/promises'
import { Dirent } from 'fs'
import path from 'path'
import { app } from 'electron'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ArtifactType = 'historia' | 'anexo' | 'validacao' | 'lacuna'

export interface Project {
  id: string
  name: string
  path: string       // caminho absoluto da pasta do projeto
  createdAt: number
  updatedAt: number
  isProject: boolean // true = tem marcador .assistente/project.json
  gitlabProjectPath?: string  // ex: "grupo/subgrupo/projeto"
}

export interface Artifact {
  id: string
  projectId: string
  type: ArtifactType
  title: string
  filePath: string   // caminho absoluto do .md gerado
  createdAt: number
  updatedAt: number
}

// Arquivo marcador dentro de cada pasta de projeto
const MARKER = '.assistente/project.json'

interface ProjectMarker {
  id: string
  name: string
  createdAt: number
  gitlabProjectPath?: string
}

// Store persiste apenas artefatos e workspacePath
interface Store {
  workspacePath: string | null
  artifacts: Artifact[]
}

// ── Persistência ─────────────────────────────────────────────────────────────

function storePath(): string {
  return path.join(app.getPath('userData'), 'projects.json')
}

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return {
      workspacePath: parsed.workspacePath ?? null,
      artifacts: parsed.artifacts ?? [],
    }
  } catch {
    return { workspacePath: null, artifacts: [] }
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf8')
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export async function getWorkspacePath(): Promise<string | null> {
  const store = await readStore()
  return store.workspacePath
}

export async function setWorkspacePath(p: string): Promise<void> {
  const store = await readStore()
  store.workspacePath = p
  await writeStore(store)
}

// ── Projetos (baseados em pastas com marcador) ─────────────────────────────────

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')  // caracteres inválidos em Windows
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'projeto'
}

async function readProjectMarker(projectDir: string): Promise<Project | null> {
  const markerPath = path.join(projectDir, MARKER)
  try {
    const raw = await fs.readFile(markerPath, 'utf8')
    const marker = JSON.parse(raw) as ProjectMarker
    const stat = await fs.stat(projectDir)
    return {
      id: marker.id,
      name: marker.name,
      path: projectDir,
      createdAt: marker.createdAt,
      updatedAt: stat.mtimeMs,
      isProject: true,
      gitlabProjectPath: marker.gitlabProjectPath,
    }
  } catch {
    return null
  }
}

export async function listProjects(workspacePath: string): Promise<Project[]> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(workspacePath, { withFileTypes: true })
  } catch {
    return []
  }

  const SKIP = ['node_modules', '.git', '.kiro', '.vscode']
  const results: Project[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (SKIP.includes(entry.name)) continue
    const fullPath = path.join(workspacePath, entry.name)
    const project = await readProjectMarker(fullPath)
    if (project) {
      results.push({ ...project, isProject: true })
    } else {
      // Pasta sem marcador: inclui como entrada não-projeto
      results.push({
        id: `dir:${fullPath}`,
        name: entry.name,
        path: fullPath,
        createdAt: 0,
        updatedAt: 0,
        isProject: false,
      })
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

/** Lista subpastas diretas de um projeto (exclui pastas ocultas e de ferramentas) */
export async function listProjectSubfolders(projectPath: string): Promise<string[]> {
  const SKIP = ['.assistente', '.kiro', '.git', '.vscode', 'node_modules']
  let entries: Dirent[]
  try { entries = await fs.readdir(projectPath, { withFileTypes: true }) } catch { return [] }
  return entries
    .filter((e) => e.isDirectory() && !SKIP.includes(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
}

/** Inicializa uma pasta existente como projeto (grava o marcador) */
export async function initializeProject(folderPath: string, name?: string, gitlabProjectPath?: string): Promise<Project> {
  await fs.mkdir(path.join(folderPath, '.assistente'), { recursive: true })
  const folderName = path.basename(folderPath)
  const marker: ProjectMarker = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: (name ?? folderName).trim() || folderName,
    createdAt: Date.now(),
    gitlabProjectPath: gitlabProjectPath?.trim() || undefined,
  }
  await fs.writeFile(
    path.join(folderPath, MARKER),
    JSON.stringify(marker, null, 2),
    'utf8',
  )
  return {
    id: marker.id,
    name: marker.name,
    path: folderPath,
    createdAt: marker.createdAt,
    updatedAt: marker.createdAt,
    isProject: true,
    gitlabProjectPath: marker.gitlabProjectPath,
  }
}

export async function createProject(name: string, workspacePath: string, gitlabProjectPath?: string): Promise<Project> {
  const folderName = sanitizeFolderName(name)
  const projectDir = path.join(workspacePath, folderName)

  // Garante que a pasta .assistente existe
  await fs.mkdir(path.join(projectDir, '.assistente'), { recursive: true })

  const marker: ProjectMarker = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || folderName,
    createdAt: Date.now(),
    gitlabProjectPath: gitlabProjectPath?.trim() || undefined,
  }
  await fs.writeFile(
    path.join(projectDir, MARKER),
    JSON.stringify(marker, null, 2),
    'utf8',
  )

  return {
    id: marker.id,
    name: marker.name,
    path: projectDir,
    createdAt: marker.createdAt,
    updatedAt: marker.createdAt,
    isProject: true,
    gitlabProjectPath: marker.gitlabProjectPath,
  }
}

export async function updateProjectGitlab(projectPath: string, gitlabProjectPath: string): Promise<void> {
  const markerPath = path.join(projectPath, MARKER)
  try {
    const raw = await fs.readFile(markerPath, 'utf8')
    const marker = JSON.parse(raw) as ProjectMarker
    marker.gitlabProjectPath = gitlabProjectPath.trim() || undefined
    await fs.writeFile(markerPath, JSON.stringify(marker, null, 2), 'utf8')
  } catch { /* pasta sem marcador — ignora */ }
}

export async function deleteProject(id: string, projectPath: string): Promise<void> {
  // Remove apenas o marcador — a pasta permanece no disco
  const markerPath = path.join(projectPath, MARKER)
  try { await fs.unlink(markerPath) } catch { /* já removido */ }

  // Limpa artefatos do store
  const store = await readStore()
  store.artifacts = store.artifacts.filter((a) => a.projectId !== id)
  await writeStore(store)
}

// ── Artefatos ─────────────────────────────────────────────────────────────────

export async function listArtifacts(projectId: string): Promise<Artifact[]> {
  const store = await readStore()
  return store.artifacts
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }))
}

export async function createArtifact(
  projectId: string,
  type: ArtifactType,
  title: string,
  content: string,
  projectFolderPath: string,
): Promise<Artifact> {
  const store = await readStore()

  // Cria a pasta .assistente/<tipo>/ dentro do projeto
  const typeFolder = path.join(projectFolderPath, '.assistente', pluralize(type))
  await fs.mkdir(typeFolder, { recursive: true })

  const safeTitle = title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)
  const fileName = `${safeTitle}.md`
  const filePath = path.join(typeFolder, fileName)

  await fs.writeFile(filePath, content, 'utf8')

  const artifact: Artifact = {
    id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    type,
    title,
    filePath,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  store.artifacts.push(artifact)
  await writeStore(store)
  return artifact
}

export async function updateArtifact(id: string, content: string): Promise<boolean> {
  const store = await readStore()
  const artifact = store.artifacts.find((a) => a.id === id)
  if (!artifact) return false
  await fs.writeFile(artifact.filePath, content, 'utf8')
  artifact.updatedAt = Date.now()
  await writeStore(store)
  return true
}

export async function readArtifactContent(id: string): Promise<string | null> {
  const store = await readStore()
  const artifact = store.artifacts.find((a) => a.id === id)
  if (!artifact) return null
  try {
    return await fs.readFile(artifact.filePath, 'utf8')
  } catch {
    return null
  }
}

export async function renameArtifact(id: string, newTitle: string): Promise<Artifact | null> {
  const store = await readStore()
  const artifact = store.artifacts.find((a) => a.id === id)
  if (!artifact) return null

  const dir       = path.dirname(artifact.filePath)
  const safeTitle = newTitle.replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80)
  const newPath   = path.join(dir, `${safeTitle}.md`)

  try { await fs.rename(artifact.filePath, newPath) } catch { return null }

  artifact.title    = newTitle.trim()
  artifact.filePath = newPath
  artifact.updatedAt = Date.now()
  await writeStore(store)
  return { ...artifact }
}

export async function deleteArtifact(id: string): Promise<void> {
  const store = await readStore()
  const artifact = store.artifacts.find((a) => a.id === id)
  if (artifact) {
    try { await fs.unlink(artifact.filePath) } catch { /* arquivo já removido */ }
  }
  store.artifacts = store.artifacts.filter((a) => a.id !== id)
  await writeStore(store)
}

/**
 * Infere o tipo de artefato a partir do caminho do arquivo.
 */
function inferType(filePath: string): ArtifactType {
  const lower = filePath.replace(/\\/g, '/').toLowerCase()
  if (lower.includes('/.assistente/historias/') || lower.includes('/historias/') || lower.includes('/historias_')) return 'historia'
  if (lower.includes('/.assistente/anexos/')    || lower.includes('/anexos/')    || lower.includes('/anexo'))    return 'anexo'
  if (lower.includes('/.assistente/validacoes/')|| lower.includes('/validacoes/')|| lower.includes('/validacao') || lower.includes('/dor')) return 'validacao'
  if (lower.includes('/.assistente/lacunas/')   || lower.includes('/lacunas/')) return 'lacuna'
  return 'historia'
}

/**
 * Coleta todos os arquivos .md dentro de `dir` até `maxDepth` níveis de profundidade,
 * ignorando as pastas da lista `exclude`.
 */
async function collectMdFiles(
  dir: string,
  maxDepth: number,
  exclude: string[],
  results: string[] = [],
): Promise<string[]> {
  if (maxDepth < 0) return results
  let entries: Dirent[]
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return results }
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectMdFiles(full, maxDepth - 1, exclude, results)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Escaneia o projeto em busca de arquivos .md, registra automaticamente os novos
 * e remove entradas cujos arquivos sumiram do disco.
 */
export async function syncProjectArtifacts(projectId: string, projectPath: string): Promise<Artifact[]> {
  const store = await readStore()

  const EXCLUDE = ['.kiro', 'node_modules', '.git', '.vscode']
  const mdFiles = await collectMdFiles(projectPath, 3, EXCLUDE)
  const foundPaths = new Set<string>(mdFiles)

  for (const filePath of mdFiles) {
    const existing = store.artifacts.find(
      (a) => a.projectId === projectId && a.filePath === filePath,
    )
    // Mantém o título sempre sincronizado com o nome atual do arquivo no disco
    if (existing) {
      const currentName = path.basename(filePath, '.md')
      if (existing.title !== currentName) existing.title = currentName
    }
    if (!existing) {
      let stat: Awaited<ReturnType<typeof fs.stat>>
      try { stat = await fs.stat(filePath) } catch { continue }

      const fileName = path.basename(filePath, '.md')
      const title    = fileName  // usa o nome do arquivo como está, sem substituições
      const type     = inferType(filePath)

      const artifact: Artifact = {
        id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        type,
        title,
        filePath,
        createdAt: (stat as any).birthtimeMs || stat.ctimeMs,
        updatedAt: stat.mtimeMs,
      }
      store.artifacts.push(artifact)
    }
  }

  // Remove entradas cujos arquivos não existem mais
  store.artifacts = store.artifacts.filter(
    (a) => a.projectId !== projectId || foundPaths.has(a.filePath),
  )

  await writeStore(store)
  return store.artifacts
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pluralize(type: ArtifactType): string {
  if (type === 'historia') return 'historias'
  if (type === 'anexo') return 'anexos'
  if (type === 'lacuna') return 'lacunas'
  return 'validacoes'
}
