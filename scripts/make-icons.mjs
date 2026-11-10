/**
 * Genera los iconos de la aplicación sin dependencias externas:
 * build/icon.png, build/icon.ico y build/icon.icns.
 *
 * Uso: node scripts/make-icons.mjs  (también se ejecuta antes de `npm run build`)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '..', 'build')
mkdirSync(buildDir, { recursive: true })

/* -------------------------------------------------------------------------- */
/* Codificación PNG                                                           */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function encodePng(size, pixels) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, rowStart + 1)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // profundidad de bits
  header[9] = 6 // RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* -------------------------------------------------------------------------- */
/* Dibujo del icono                                                           */
/* -------------------------------------------------------------------------- */

const clamp = (value) => Math.min(1, Math.max(0, value))
const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t)

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const lengthSquared = vx * vx + vy * vy
  const t = clamp((wx * vx + wy * vy) / lengthSquared)
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

function sample(nx, ny) {
  const radius = 0.215
  const half = 0.455
  const dx = Math.abs(nx - 0.5) - (half - radius)
  const dy = Math.abs(ny - 0.5) - (half - radius)
  const distance =
    Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius

  if (distance > 0) return [0, 0, 0, 0]

  // Fondo con degradado diagonal y un leve brillo superior.
  let color = mix([23, 35, 46], [9, 14, 19], clamp(nx * 0.32 + ny * 0.68))
  const glow = Math.max(0, 1 - Math.hypot(nx - 0.3, ny - 0.24) / 0.75)
  color = mix(color, [22, 48, 50], glow * 0.32)

  // Borde luminoso.
  const edge = clamp((distance + 0.02) / 0.02)
  color = mix(color, [110, 231, 183], edge * 0.22)

  // Chevron + guion bajo.
  const stroke =
    Math.min(
      segmentDistance(nx, ny, 0.3, 0.315, 0.5, 0.5),
      segmentDistance(nx, ny, 0.5, 0.5, 0.3, 0.685),
      segmentDistance(nx, ny, 0.575, 0.682, 0.73, 0.682)
    ) / 1
  const width = 0.044
  const coverage =
    stroke <= width ? 1 : stroke <= width + 0.013 ? (width + 0.013 - stroke) / 0.013 : 0

  if (coverage > 0) {
    const tone = mix([127, 240, 189], [56, 189, 248], clamp(nx * 0.62 + ny * 0.38))
    color = mix(color, tone, coverage)
  }

  return [color[0], color[1], color[2], 255]
}

function render(size) {
  const supersample = size >= 512 ? 2 : 4
  const out = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let alphaSum = 0
      let redSum = 0
      let greenSum = 0
      let blueSum = 0

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const [r, g, b, a] = sample(
            (x + (sx + 0.5) / supersample) / size,
            (y + (sy + 0.5) / supersample) / size
          )
          const alpha = a / 255
          alphaSum += alpha
          redSum += r * alpha
          greenSum += g * alpha
          blueSum += b * alpha
        }
      }

      const samples = supersample * supersample
      const index = (y * size + x) * 4
      if (alphaSum > 0) {
        out[index] = Math.round(redSum / alphaSum)
        out[index + 1] = Math.round(greenSum / alphaSum)
        out[index + 2] = Math.round(blueSum / alphaSum)
        out[index + 3] = Math.round((alphaSum / samples) * 255)
      }
    }
  }

  return out
}

/* -------------------------------------------------------------------------- */
/* Formatos ICO / ICNS                                                        */
/* -------------------------------------------------------------------------- */

function buildIco(pngBySize, sizes) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  const entries = []
  const images = []
  let offset = 6 + sizes.length * 16

  for (const size of sizes) {
    const png = pngBySize.get(size)
    if (!png) continue
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(entry)
    images.push(png)
  }

  return Buffer.concat([header, ...entries, ...images])
}

function buildIcns(pngBySize) {
  const definitions = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024]
  ]

  const entries = []
  let total = 8

  for (const [type, size] of definitions) {
    const png = pngBySize.get(size)
    if (!png) continue
    const header = Buffer.alloc(8)
    header.write(type, 0, 4, 'ascii')
    header.writeUInt32BE(png.length + 8, 4)
    entries.push(header, png)
    total += png.length + 8
  }

  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(total, 4)
  return Buffer.concat([header, ...entries])
}

/* -------------------------------------------------------------------------- */
/* Generación                                                                 */
/* -------------------------------------------------------------------------- */

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
const pngBySize = new Map()

for (const size of sizes) {
  pngBySize.set(size, encodePng(size, render(size)))
}

writeFileSync(join(buildDir, 'icon.png'), pngBySize.get(512))
writeFileSync(join(buildDir, 'icon.ico'), buildIco(pngBySize, [16, 32, 48, 64, 128, 256]))
writeFileSync(join(buildDir, 'icon.icns'), buildIcns(pngBySize))

console.log('Iconos generados en build/: icon.png, icon.ico, icon.icns')
