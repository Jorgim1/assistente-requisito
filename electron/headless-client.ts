import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { EventEmitter } from 'events'
import fs from 'fs'
import os from 'os'
import path from 'path'

function resolveKiroCli(): string {
  if (process.platform === 'win32') {
    const localApp = process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? 'C:\\Users\\Default', 'AppData', 'Local')
    const candidate = path.join(localApp, 'Kiro-Cli', 'kiro-cli.exe')
    if (fs.existsSync(candidate)) return candidate
  }
  return 'kiro-cli'
}

export type ClientStatus = 'disconnected' | 'connecting' | 'ready' | 'error'

export interface KiroModel {
  model_id:              string
  model_name:            string
  description:           string
  rate_multiplier:       number
  rate_unit:             string
  context_window_tokens: number
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

export class HeadlessClient extends EventEmitter {
  private cwd        = ''
  private apiKey?:   string
  private activeProc: ChildProcess | null = null
  private warmProc:   ChildProcess | null = null
  private warmTimer:  ReturnType<typeof setTimeout> | null = null
  private currentTurnCredits = 0
  private kiroSessionId: string | null = null  // ID da sessão kiro-cli atual, para --resume-id

  status:       ClientStatus = 'disconnected'
  currentModel: string       = 'auto'

  resetKiroSession() {
    this.kiroSessionId = null
    this._killWarm()
  }

  setKiroSession(id: string | null) {
    this._emitLog('info', `setKiroSession: ${id ?? '(null)'}`)
    this.kiroSessionId = id
    this._killWarm()
    if (id && this.status === 'ready') this._preWarm()
  }

  setCwd(cwd: string) {
    this.cwd = cwd
    this.kiroSessionId = null
    this._killWarm()
    if (this.status === 'ready') this._preWarm()
  }

  getCwd(): string {
    return this.cwd
  }

  // ── Lista modelos disponíveis ──────────────────────────────────
  fetchModels(): Promise<KiroModel[]> {
    return new Promise((resolve) => {
      const proc = spawn(
        resolveKiroCli(),
        ['chat', '--list-models', '--format', 'json'],
        { env: this._env(), stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
      )
      let output = ''
      proc.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString() })
      proc.on('exit', () => {
        try {
          const parsed = JSON.parse(output)
          resolve(Array.isArray(parsed.models) ? parsed.models : [])
        } catch { resolve([]) }
      })
      proc.on('error', () => resolve([]))
    })
  }

  private _baseArgs(): string[] {
    const args = [
      'chat', '--no-interactive',
      '--output-format', 'stream-json',
      '--agent-engine', 'v2',
      '--trust-all-tools',
    ]
    if (this.currentModel && this.currentModel !== 'auto') {
      args.push('--model', this.currentModel)
    }
    if (this.kiroSessionId) {
      args.push('--resume-id', this.kiroSessionId)
    }
    return args
  }

  private _env() {
    return {
      ...process.env,
      ...(this.apiKey ? { KIRO_API_KEY: this.apiKey, ANTHROPIC_API_KEY: this.apiKey } : {}),
    }
  }

  private _killWarm() {
    if (this.warmTimer) { clearTimeout(this.warmTimer); this.warmTimer = null }
    if (this.warmProc)  { this.warmProc.kill(); this.warmProc = null }
  }

  // Sobe um processo kiro-cli em segundo plano enquanto o usuário lê a resposta
  private _preWarm() {
    if (this.warmProc || this.status !== 'ready' || !this.cwd) return
    this._emitLog('info', 'Pre-warming kiro-cli...')
    const proc = spawn(resolveKiroCli(), this._baseArgs(), {
      cwd: this.cwd, env: this._env(), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
    })
    this.warmProc = proc
    proc.on('exit', () => { if (this.warmProc === proc) this.warmProc = null })
    proc.on('error', () => { if (this.warmProc === proc) this.warmProc = null })
    // Mata após 60s para não deixar zumbi
    this.warmTimer = setTimeout(() => { this._killWarm() }, 60_000)
  }

  // ── Verifica instalação do kiro-cli ────────────────────────────
  connect(cwd: string, apiKey?: string) {
    this.cwd = cwd
    this.apiKey = apiKey
    this._setStatus('connecting')

    const check = spawn(resolveKiroCli(), ['--version'], {
      env: this._env(),
      stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    })

    this._emitLog('info', 'Verificando instalação do kiro-cli...')

    check.on('error', (err: NodeJS.ErrnoException) => {
      this._emitLog('error', `Erro ao verificar kiro-cli: ${err.message}`)
      this._setStatus('error')
      this.emit('acp-error',
        err.code === 'ENOENT'
          ? 'kiro-cli não encontrado. Instale em: https://kiro.dev/docs/cli/'
          : `Erro: ${err.message}`,
      )
    })

    check.on('exit', (code) => {
      this._emitLog('info', `kiro-cli --version saiu com código ${code}`)
      if (code === 0 || code === null) {
        this._setStatus('ready')
        // Pre-aquece imediatamente para a primeira mensagem ser rápida
        this._preWarm()
        // Busca whoami e créditos em paralelo ao ficar pronto
        this.fetchWhoami().then((info) => {
          if (info) this.emit('acp-whoami', info)
        })
        this.fetchUsage().then((text) => {
          if (text) this.emit('acp-credits', text)
        })
      } else {
        this._setStatus('error')
        this.emit('acp-error', 'kiro-cli retornou erro. Verifique login: kiro-cli auth login')
      }
    })
  }

  // ── Busca email/plano via kiro-cli whoami ──────────────────────
  fetchWhoami(): Promise<{ email: string } | null> {
    return new Promise((resolve) => {
      const proc = spawn(resolveKiroCli(), ['whoami'], {
        env: this._env(),
        stdio: ['ignore', 'pipe', 'ignore'],
      })

      let output = ''
      proc.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString() })

      proc.on('exit', () => {
        const emailMatch = output.match(/^Email:\s*(.+)$/m)
        const email = emailMatch?.[1]?.trim() ?? ''
        this._emitLog('info', `whoami: ${email || '(sem email)'}`)
        resolve(email ? { email } : null)
      })

      proc.on('error', () => resolve(null))
    })
  }

  // ── Busca créditos via /usage ──────────────────────────────────
  // Resposta vem no campo runFinished.data.finalText (formato ACP)
  fetchUsage(): Promise<string> {
    return new Promise((resolve) => {
      const proc = spawn(
        resolveKiroCli(),
        ['chat', '--no-interactive', '--output-format', 'stream-json', '--agent-engine', 'v2'],
        { cwd: this.cwd || os.homedir(), env: this._env(), stdio: ['pipe', 'pipe', 'ignore'] },
      )

      this._emitLog('info', 'fetchUsage: processo kiro-cli iniciado')

      let finalText = ''
      let resolved = false

      const done = () => {
        if (!resolved) { resolved = true; resolve(finalText.trim()) }
      }

      const rl = createInterface({ input: proc.stdout! })
      rl.on('line', (line) => {
        if (!line.trim()) return
        this._emitLog('raw', line)
        try {
          const msg = JSON.parse(line)
          // O texto completo da resposta está em runFinished.data.finalText
          if (msg.type === 'runFinished' && msg.data?.finalText) {
            finalText = msg.data.finalText
          }
        } catch { /* ignora não-JSON */ }
      })

      proc.on('exit', (code) => {
        this._emitLog('info', `fetchUsage: processo encerrado com código ${code}`)
        done()
      })
      proc.on('error', (err) => {
        this._emitLog('error', `fetchUsage: erro no processo: ${err.message}`)
        resolve('')
      })

      // Timeout de 30s
      const timer = setTimeout(() => { proc.kill(); done() }, 30_000)
      proc.on('exit', () => clearTimeout(timer))

      proc.stdin!.write('/usage\n')
      proc.stdin!.end()
    })
  }

  // ── Envia prompt ───────────────────────────────────────────────
  // Usa processo pre-aquecido se disponível (elimina ~6s de startup)
  sendPrompt(text: string) {
    if (this.status !== 'ready') {
      this.emit('acp-error', 'kiro-cli não está pronto.')
      return
    }

    this.activeProc?.kill()
    this.currentTurnCredits = 0

    // Usa processo pre-aquecido ou sobe um novo
    const usingWarm = !!this.warmProc
    const proc = this.warmProc ?? spawn(resolveKiroCli(), this._baseArgs(), {
      cwd: this.cwd, env: this._env(), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
    })
    if (usingWarm) {
      // O processo warm tem stderr em ignore; redireciona stdout para inherit
      this._emitLog('info', 'sendPrompt: usando processo pre-aquecido ⚡')
      if (this.warmTimer) { clearTimeout(this.warmTimer); this.warmTimer = null }
    }
    this.warmProc = null
    this.activeProc = proc

    if (!usingWarm) this._emitLog('info', 'sendPrompt: processo kiro-cli iniciado (cold)')

    const modelUsed = this.currentModel
    let turnEndEmitted = false
    const emitTurnEnd = () => {
      if (!turnEndEmitted) {
        turnEndEmitted = true
        this.emit('acp-update', { type: 'TurnEnd', model: modelUsed, credits: this.currentTurnCredits })
        setTimeout(() => this._preWarm(), 500)
      }
    }

    proc.on('error', (err: NodeJS.ErrnoException) => {
      this._emitLog('error', `sendPrompt: erro: ${err.message}`)
      this.activeProc = null
      this.emit('acp-error', `Erro kiro-cli: ${err.message}`)
      emitTurnEnd()
    })

    proc.on('exit', (code) => {
      this._emitLog('info', `sendPrompt: encerrado com código ${code}`)
      this.activeProc = null
      emitTurnEnd()
    })

    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      if (!line.trim()) return
      this._emitLog('raw', line)
      try { this._handleLine(JSON.parse(line), emitTurnEnd) } catch { /* ignora não-JSON */ }
    })

    proc.stdin!.write(text + '\n')
    proc.stdin!.end()
  }

  cancel() {
    this.activeProc?.kill('SIGTERM')
    this.activeProc = null
    this.emit('acp-update', { type: 'TurnEnd' })
  }

  disconnect() {
    this._killWarm()
    this.activeProc?.kill()
    this.activeProc = null
    this.cwd = ''
    this.apiKey = undefined
    this._setStatus('disconnected')
  }

  // ── Parsing do stream-json (formato ACP do kiro-cli headless) ───
  // Formato real:
  //   {"type":"runStarted","data":{...}}
  //   {"type":"metadata","data":{"sessionId":"...","contextUsagePercentage":...}}
  //   {"type":"sessionUpdate","data":{"update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"..."}}}}
  //   {"type":"metadata","data":{"meteringUsage":[{"value":0.05,"unit":"credit","unitPlural":"credits"}]}}
  //   {"type":"runFinished","data":{"finalText":"...","status":"success"}}
  private _handleLine(msg: any, emitTurnEnd?: () => void) {
    const data = msg.data ?? {}

    switch (msg.type) {
      case 'runStarted':
        break

      case 'sessionUpdate': {
        const update = data.update
        if (!update) break

        if (update.sessionUpdate === 'agent_message_chunk') {
          const content = update.content
          if (content?.type === 'text') {
            this.emit('acp-update', { type: 'AgentMessageChunk', content: content.text ?? '' })
          } else if (content?.type === 'tool_use') {
            this.emit('acp-update', {
              type:     'ToolCallStart',
              toolName: content.name ?? '',
              toolId:   content.id,
              args:     content.input ?? {},
            })
          }
        } else if (update.sessionUpdate === 'tool_result') {
          const output = typeof update.content === 'string'
            ? update.content
            : JSON.stringify(update.content)
          this.emit('acp-update', {
            type:   'ToolCallEnd',
            toolId: update.toolUseId ?? update.tool_use_id,
            status: update.isError ? 'error' : 'success',
            output,
          })
        }
        break
      }

      case 'metadata': {
        // Captura o sessionId para reutilizar com --resume-id no próximo turno.
        // Descarta o warm proc atual (sem --resume-id) para que o próximo seja gerado já com o ID.
        if (typeof data.sessionId === 'string' && data.sessionId && this.kiroSessionId !== data.sessionId) {
          this.kiroSessionId = data.sessionId
          this._emitLog('info', `kiro sessionId: ${data.sessionId}`)
          this.emit('acp-session-id', data.sessionId)
          this._killWarm()  // mata warm proc gerado com ID anterior
        }
        // Percentual da janela de contexto usada (vem no primeiro metadata do turno)
        if (typeof data.contextUsagePercentage === 'number') {
          this.emit('acp-context', data.contextUsagePercentage)
        }
        // Créditos gastos neste turno (vem no último metadata)
        if (Array.isArray(data.meteringUsage) && data.meteringUsage.length > 0) {
          const m = data.meteringUsage[0] as { value: number; unitPlural: string }
          this._emitLog('info', `Créditos neste turno: ${m.value.toFixed(4)} ${m.unitPlural}`)
          this.currentTurnCredits += m.value
          this.emit('acp-usage', { inputTokens: 0, outputTokens: 0, credits: m.value } satisfies TokenUsage)
        }
        break
      }

      case 'runFinished': {
        // Encerra o turno com o texto completo
        emitTurnEnd?.()
        break
      }

      case 'error': {
        const errMsg = data.message ?? data.error?.message ?? JSON.stringify(data)
        this._emitLog('error', `kiro-cli error: ${errMsg}`)
        this.emit('acp-error', errMsg)
        emitTurnEnd?.()
        break
      }

      default:
        break
    }
  }

  private _setStatus(s: ClientStatus) {
    this.status = s
    this._emitLog('info', `Status: ${s}`)
    this.emit('acp-status', s)
  }

  private _emitLog(level: LogEntry['level'], message: string) {
    this.emit('log', { level, message } satisfies LogEntry)
  }
}
