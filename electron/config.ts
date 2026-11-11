import path from 'path'
import fs from 'fs'
import { app } from 'electron'

interface Config {
  kiroApiKey?:    string
  selectedModel?: string
  proxyUrl?:      string
  gitlabApiUrl?:  string
  gitlabToken?:   string
}

function configPath() {
  return path.join(app.getPath('userData'), 'assistente-ia.json')
}

export async function readConfig(): Promise<Config> {
  try {
    const raw = await fs.promises.readFile(configPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function writeConfig(cfg: Config): Promise<void> {
  const p = configPath()
  await fs.promises.mkdir(path.dirname(p), { recursive: true })
  await fs.promises.writeFile(p, JSON.stringify(cfg, null, 2))
}
