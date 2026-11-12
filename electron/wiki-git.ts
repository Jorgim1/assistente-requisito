import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

function run(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve((out || err).trim())  // git push escreve progresso no stderr
      else reject(new Error(err.trim() || out.trim() || `git exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

export function wikiRepoPath(projectPath: string): string {
  return path.join(projectPath, '.wiki')
}

export async function wikiIsCloned(localPath: string): Promise<boolean> {
  try {
    await fs.promises.access(path.join(localPath, '.git'))
    return true
  } catch {
    return false
  }
}

export async function wikiClone(apiUrl: string, projectPath: string, token: string, localPath: string): Promise<void> {
  // Strip /api/v4 (or similar) from the API URL to get the base GitLab URL
  const baseUrl = apiUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '')
  const authUrl = baseUrl.replace('://', `://oauth2:${token}@`)
  const cloneUrl = `${authUrl}/${projectPath}.wiki.git`
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true })
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('git', ['clone', cloneUrl, localPath], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    let err = ''
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err.trim() || `git clone exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function wikiPull(localPath: string): Promise<string> {
  return run(['pull', '--rebase'], localPath)
}

export async function wikiPush(localPath: string): Promise<string> {
  return run(['push'], localPath)
}

export async function wikiStatus(localPath: string): Promise<string> {
  return run(['status', '--short'], localPath)
}

export async function wikiDiff(localPath: string, file?: string): Promise<string> {
  const args = ['diff', 'HEAD']
  if (file) args.push('--', file)
  return run(args, localPath).catch(() => run(['diff'], localPath))
}

export async function wikiLog(localPath: string, limit = 10): Promise<string> {
  return run(['log', `--max-count=${limit}`, '--oneline', '--graph'], localPath)
}

export async function wikiCommit(localPath: string, message: string): Promise<string> {
  await run(['add', '-A'], localPath)
  return run(['commit', '-m', message], localPath)
}

export async function wikiListPages(localPath: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(localPath)
    return entries.filter((f) => f.endsWith('.md') && !f.startsWith('.'))
  } catch {
    return []
  }
}

export async function wikiReadPage(localPath: string, filename: string): Promise<string> {
  return fs.promises.readFile(path.join(localPath, filename), 'utf-8')
}

export async function wikiWritePage(localPath: string, filename: string, content: string): Promise<void> {
  await fs.promises.writeFile(path.join(localPath, filename), content, 'utf-8')
}

// Descarta alterações de um arquivo (ou todos) no working tree
export async function wikiRestore(localPath: string, file?: string): Promise<string> {
  if (file) {
    // Para arquivos não rastreados (untracked) usa clean; para modificados/deletados usa restore
    const status = await run(['status', '--porcelain', '--', file], localPath).catch(() => '')
    if (status.startsWith('??')) {
      await run(['clean', '-fd', '--', file], localPath)
      return `${file} removido`
    }
    return run(['restore', '--', file], localPath)
  }
  // Descarta todas as alterações rastreadas; remove untracked também
  await run(['restore', '.'], localPath).catch(() => { /* ignore if nothing to restore */ })
  await run(['clean', '-fd'], localPath).catch(() => { /* ignore if nothing to clean */ })
  return 'Todas as alterações descartadas'
}
