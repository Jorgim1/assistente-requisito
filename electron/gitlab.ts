import { net } from 'electron'

export interface WikiPage {
  slug: string
  title: string
  format: string
  content?: string
}

export interface GitlabConfig {
  apiUrl: string   // ex: "https://git.prodemge.gov.br/api/v4"
  token: string
}

function encodeProjectPath(projectPath: string): string {
  return encodeURIComponent(projectPath)
}

async function gitlabFetch(
  cfg: GitlabConfig,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const url = `${cfg.apiUrl.replace(/\/$/, '')}${path}`
  const headers: Record<string, string> = {
    'PRIVATE-TOKEN': cfg.token,
    'Content-Type': 'application/json',
  }

  const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = net.request({ url, method: options.method ?? 'GET' })
    Object.entries(headers).forEach(([k, v]) => req.setHeader(k, v))

    const chunks: Buffer[] = []
    req.on('response', (res) => {
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', reject)
    })
    req.on('error', reject)

    if (options.body) req.write(JSON.stringify(options.body))
    req.end()
  })

  if (response.status >= 400) {
    throw new Error(`GitLab API error ${response.status}: ${response.body}`)
  }

  try { return JSON.parse(response.body) } catch { return response.body }
}

export async function listWikiPages(cfg: GitlabConfig, projectPath: string): Promise<WikiPage[]> {
  const encoded = encodeProjectPath(projectPath)
  const pages = await gitlabFetch(cfg, `/projects/${encoded}/wikis?with_content=0`) as WikiPage[]
  return pages.map((p) => ({ slug: p.slug, title: p.title, format: p.format }))
}

export async function getWikiPage(cfg: GitlabConfig, projectPath: string, slug: string): Promise<WikiPage> {
  const encoded = encodeProjectPath(projectPath)
  return await gitlabFetch(cfg, `/projects/${encoded}/wikis/${encodeURIComponent(slug)}`) as WikiPage
}

export async function createWikiPage(
  cfg: GitlabConfig,
  projectPath: string,
  title: string,
  content: string,
): Promise<WikiPage> {
  const encoded = encodeProjectPath(projectPath)
  return await gitlabFetch(cfg, `/projects/${encoded}/wikis`, {
    method: 'POST',
    body: { title, content, format: 'markdown' },
  }) as WikiPage
}

export async function updateWikiPage(
  cfg: GitlabConfig,
  projectPath: string,
  slug: string,
  content: string,
  title?: string,
): Promise<WikiPage> {
  const encoded = encodeProjectPath(projectPath)
  return await gitlabFetch(cfg, `/projects/${encoded}/wikis/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: { content, format: 'markdown', ...(title ? { title } : {}) },
  }) as WikiPage
}
