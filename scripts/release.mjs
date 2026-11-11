/**
 * Script de release do Assistente IA.
 * Uso: node scripts/release.mjs <versao>
 * Ex:  node scripts/release.mjs 0.2.0
 *
 * Requer a variável de ambiente GH_TOKEN com um Personal Access Token
 * do GitHub com permissão "Contents: write" no repo pro-acelerai/powers-kiro.
 */

import { execSync }                            from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { readFile }                            from 'node:fs/promises'
import path                                    from 'node:path'
import { fileURLToPath }                       from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')

// ── Helpers de log ────────────────────────────────────────────────
const ok   = (msg) => console.log(`\x1b[32m✓\x1b[0m  ${msg}`)
const info = (msg) => console.log(`\x1b[36m→\x1b[0m  ${msg}`)
const fail = (msg) => { console.error(`\x1b[31m✗\x1b[0m  ${msg}`); process.exit(1) }

// ── Argumentos ───────────────────────────────────────────────────
const version = process.argv[2]
if (!version)                          fail('Uso: node scripts/release.mjs <versao>  (ex: 0.2.0)')
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Versão inválida: "${version}". Use semver: 1.2.3`)

const tag   = `v${version}`
const token = process.env.GH_TOKEN
if (!token) fail('Defina a variável GH_TOKEN com um Personal Access Token do GitHub.')

// ── 1. Atualiza package.json ──────────────────────────────────────
info(`Atualizando package.json para ${version}...`)
const pkgPath  = path.join(ROOT, 'package.json')
const pkg      = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const anterior = pkg.version
pkg.version    = version
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
ok(`Versão: ${anterior} → ${version}`)

// ── 2. Build + dist ───────────────────────────────────────────────
console.log()
info('Gerando instalador (npm run dist:win)...')
// CSC_IDENTITY_AUTO_DISCOVERY=false ignora code signing quando não há certificado configurado.
execSync('npm run dist:win', {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
})
console.log()

// ── 3. Localiza os assets gerados ─────────────────────────────────
const artifactName = (pkg.build?.win?.artifactName ?? '${productName}-Setup-${version}.${ext}')
  .replace('${productName}', (pkg.build?.productName ?? 'Assistente IA').replace(/ /g, '-'))
  .replace('${version}', version)
  .replace('${ext}', 'exe')
const exeName     = artifactName
const exePath     = path.join(ROOT, 'release', exeName)
const ymlPath     = path.join(ROOT, 'release', 'latest.yml')

if (!existsSync(exePath)) fail(`Instalador não encontrado: ${exePath}`)
if (!existsSync(ymlPath)) fail(`latest.yml não encontrado: ${ymlPath}`)
ok(`Instalador: ${exeName}`)
ok('latest.yml encontrado')

// ── 4. Cria o release no GitHub ───────────────────────────────────
const owner = pkg.build?.publish?.owner ?? 'pro-acelerai'
const repo  = pkg.build?.publish?.repo  ?? 'powers-kiro'
const api   = 'https://api.github.com'
const headers = {
  Authorization         : `Bearer ${token}`,
  Accept                : 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

console.log()
info(`Criando release ${tag} em ${owner}/${repo}...`)

const releaseRes = await fetch(`${api}/repos/${owner}/${repo}/releases`, {
  method : 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body   : JSON.stringify({
    tag_name              : tag,
    name                  : `${pkg.build?.productName ?? 'Assistente IA'} ${version}`,
    generate_release_notes: true,
    draft                 : false,
    prerelease            : false,
  }),
})

if (!releaseRes.ok) {
  const err = await releaseRes.text()
  fail(`Erro ao criar release (${releaseRes.status}): ${err}`)
}

const release    = await releaseRes.json()
const uploadBase = release.upload_url.replace('{?name,label}', '')
ok(`Release criado: ${release.html_url}`)

// ── 5. Faz upload dos assets ──────────────────────────────────────
async function uploadAsset(filePath, mimeType) {
  const nome     = path.basename(filePath)
  const conteudo = await readFile(filePath)
  info(`Enviando ${nome} (${(conteudo.length / 1024 / 1024).toFixed(1)} MB)...`)
  const res = await fetch(`${uploadBase}?name=${encodeURIComponent(nome)}`, {
    method : 'POST',
    headers: { ...headers, 'Content-Type': mimeType, 'Content-Length': String(conteudo.length) },
    body   : conteudo,
    duplex : 'half',
  })
  if (!res.ok) {
    const err = await res.text()
    fail(`Erro ao enviar ${nome} (${res.status}): ${err}`)
  }
  ok(`${nome} enviado`)
}

console.log()
await uploadAsset(exePath, 'application/octet-stream')
await uploadAsset(ymlPath, 'text/yaml')

// ── Concluído ─────────────────────────────────────────────────────
console.log()
console.log(`\x1b[32m✅ Release ${tag} publicado com sucesso!\x1b[0m`)
console.log(`   ${release.html_url}`)
console.log()
console.log('   Os usuários com o app instalado receberão a atualização')
console.log('   automaticamente na próxima vez que abrirem o Assistente IA.')
