import sharp from 'sharp'
import png2icons from 'png2icons'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const svgPath = path.join(root, 'public', 'icon.svg')
const pngPath = path.join(root, 'public', 'icon.png')
const icoPath = path.join(root, 'public', 'icon.ico')

// SVG → PNG 256x256
const svgBuffer = fs.readFileSync(svgPath)
await sharp(svgBuffer)
  .resize(256, 256)
  .png()
  .toFile(pngPath)
console.log('✓ icon.png gerado (256x256)')

// PNG → ICO (tamanhos: 16, 24, 32, 48, 64, 128, 256)
const pngBuffer = fs.readFileSync(pngPath)
const icoBuffer = png2icons.createICO(pngBuffer, png2icons.BILINEAR, 0, true)
if (!icoBuffer) { console.error('✗ Falha ao gerar .ico'); process.exit(1) }
fs.writeFileSync(icoPath, icoBuffer)
console.log('✓ icon.ico gerado com múltiplos tamanhos')
console.log(`  → ${icoPath}`)
