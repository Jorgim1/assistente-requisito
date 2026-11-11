import path from 'path'
import fs from 'fs'
import { app } from 'electron'

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

export interface StoredSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  feature?: string
  kiroSessionId?: string
  messages: StoredMessage[]
}

function historyPath() {
  return path.join(app.getPath('userData'), 'history.json')
}

async function readAll(): Promise<StoredSession[]> {
  try {
    const raw = await fs.promises.readFile(historyPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// Serializes concurrent writes to avoid read→write races
let writeQueue: Promise<void> = Promise.resolve()

function writeAll(sessions: StoredSession[]): Promise<void> {
  writeQueue = writeQueue.then(() =>
    fs.promises.writeFile(historyPath(), JSON.stringify(sessions, null, 2))
  )
  return writeQueue
}

export async function listSessions(): Promise<StoredSession[]> {
  const all = await readAll()
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getSession(id: string): Promise<StoredSession | null> {
  const all = await readAll()
  return all.find((s) => s.id === id) ?? null
}

function makeTitle(text: string): string {
  const cleaned = text.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim()
  const m = cleaned.match(/^(.{5,80}?)[.!?\n]/)
  const raw = m ? m[1].trim() : cleaned.slice(0, 60).trimEnd()
  return raw.length < cleaned.length ? raw + '…' : raw
}

export async function createSession(firstUserText: string, feature?: string): Promise<StoredSession> {
  const title = makeTitle(firstUserText)
  const now = Date.now()
  const session: StoredSession = {
    id: `s-${now}`,
    title,
    createdAt: now,
    updatedAt: now,
    ...(feature ? { feature } : {}),
    messages: [],
  }
  const all = await readAll()
  all.push(session)
  await writeAll(all)
  return session
}

export async function appendMessage(sessionId: string, msg: StoredMessage): Promise<boolean> {
  const all = await readAll()
  const idx = all.findIndex((s) => s.id === sessionId)
  if (idx === -1) return false
  all[idx].messages.push(msg)
  all[idx].updatedAt = Date.now()
  await writeAll(all)
  return true
}

export async function updateKiroSessionId(sessionId: string, kiroSessionId: string): Promise<boolean> {
  const all = await readAll()
  const idx = all.findIndex((s) => s.id === sessionId)
  if (idx === -1) return false
  all[idx].kiroSessionId = kiroSessionId
  await writeAll(all)
  return true
}

export async function deleteSession(id: string): Promise<void> {
  const all = await readAll()
  await writeAll(all.filter((s) => s.id !== id))
}
