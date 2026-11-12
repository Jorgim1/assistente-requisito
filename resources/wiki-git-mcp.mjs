#!/usr/bin/env node
/**
 * Wiki Git MCP Server — stdio transport
 * Expõe operações git da wiki local para o kiro-cli via MCP.
 * Configurado via variável de ambiente WIKI_PATH.
 */
import { spawn } from 'child_process'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import readline from 'readline'

const WIKI_PATH = process.env.WIKI_PATH

function runGit(args, cwd = WIKI_PATH) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.stderr.on('data', (d) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(err.trim() || out.trim() || `git exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

function respond(id, result) {
  if (id !== undefined && id !== null) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
  }
}

function respondError(id, code, message) {
  if (id !== undefined && id !== null) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
  }
}

const TOOLS = [
  {
    name: 'wiki_status',
    description: 'Mostra o status git da wiki: quais arquivos foram modificados, adicionados ou removidos localmente.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'wiki_diff',
    description: 'Mostra as diferenças (diff) dos arquivos modificados na wiki em relação ao último commit.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Arquivo específico (opcional)' },
      },
    },
  },
  {
    name: 'wiki_log',
    description: 'Mostra o histórico de commits da wiki.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número máximo de commits a exibir (padrão: 10)' },
      },
    },
  },
  {
    name: 'wiki_list_pages',
    description: 'Lista todas as páginas (arquivos .md) disponíveis na wiki local.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'wiki_read_page',
    description: 'Lê o conteúdo de uma página da wiki.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Nome do arquivo .md (ex: home.md)' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'wiki_write_page',
    description: 'Escreve ou atualiza o conteúdo de uma página da wiki local (não commita automaticamente).',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Nome do arquivo .md' },
        content:  { type: 'string', description: 'Conteúdo markdown da página' },
      },
      required: ['filename', 'content'],
    },
  },
  {
    name: 'wiki_commit',
    description: 'Commita todas as mudanças locais da wiki com uma mensagem de commit.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensagem do commit' },
      },
      required: ['message'],
    },
  },
  {
    name: 'wiki_pull',
    description: 'Baixa e integra as atualizações da wiki remota (git pull --rebase).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'wiki_push',
    description: 'Envia os commits locais para a wiki remota (git push).',
    inputSchema: { type: 'object', properties: {} },
  },
]

async function callTool(name, args = {}) {
  if (!WIKI_PATH) throw new Error('WIKI_PATH não definido. Configure o MCP server corretamente.')

  switch (name) {
    case 'wiki_status':
      return await runGit(['status', '--short'])

    case 'wiki_diff': {
      const diffArgs = ['diff', 'HEAD']
      if (args.file) diffArgs.push('--', args.file)
      return await runGit(diffArgs).catch(() => runGit(['diff']))
    }

    case 'wiki_log':
      return await runGit(['log', `--max-count=${args.limit ?? 10}`, '--oneline', '--graph'])

    case 'wiki_list_pages': {
      const entries = await readdir(WIKI_PATH)
      const pages = entries.filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      return pages.length > 0 ? pages.join('\n') : '(nenhuma página encontrada)'
    }

    case 'wiki_read_page':
      return await readFile(join(WIKI_PATH, args.filename), 'utf-8')

    case 'wiki_write_page':
      await writeFile(join(WIKI_PATH, args.filename), args.content, 'utf-8')
      return `Página "${args.filename}" salva com sucesso.`

    case 'wiki_commit':
      await runGit(['add', '-A'])
      return await runGit(['commit', '-m', args.message])

    case 'wiki_pull':
      return await runGit(['pull', '--rebase'])

    case 'wiki_push':
      return await runGit(['push'])

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })

rl.on('line', async (line) => {
  if (!line.trim()) return
  let msg
  try { msg = JSON.parse(line) } catch { return }

  const { id, method, params } = msg

  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'wiki-git-mcp', version: '1.0.0' },
        })
        break

      case 'notifications/initialized':
        // no-op — notification, sem resposta
        break

      case 'tools/list':
        respond(id, { tools: TOOLS })
        break

      case 'tools/call': {
        const { name, arguments: toolArgs = {} } = params ?? {}
        const result = await callTool(name, toolArgs)
        respond(id, { content: [{ type: 'text', text: String(result || '(sem saída)') }] })
        break
      }

      case 'ping':
        respond(id, {})
        break

      default:
        respondError(id, -32601, `Method not found: ${method}`)
    }
  } catch (err) {
    respondError(id, -32000, err.message)
  }
})
