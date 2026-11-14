/**
 * Download the NASA/NAIF kernels into web/kernels and check their SHA-256.
 *   npx tsx scripts/kernels.ts          verify (download what is missing)
 *   npx tsx scripts/kernels.ts --pin    record the checksums of the files on disk
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KERNELS } from '../src/ephemeris/spice.ts'

const here = dirname(fileURLToPath(import.meta.url))
export const KERNEL_DIR = join(here, '..', 'kernels')
const CHECKSUMS = join(here, 'kernel-checksums.json')

export async function loadKernelFiles(pin = false): Promise<ArrayBuffer[]> {
  mkdirSync(KERNEL_DIR, { recursive: true })
  const expected: Record<string, string> = existsSync(CHECKSUMS)
    ? JSON.parse(readFileSync(CHECKSUMS, 'utf8'))
    : {}
  const found: Record<string, string> = {}
  const buffers: ArrayBuffer[] = []
  for (const { name, url } of KERNELS) {
    const path = join(KERNEL_DIR, name)
    if (!existsSync(path)) {
      console.log(`downloading ${name} ...`)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      writeFileSync(path, Buffer.from(await response.arrayBuffer()))
    }
    const data = readFileSync(path)
    found[name] = createHash('sha256').update(data).digest('hex')
    if (!pin && expected[name] && expected[name] !== found[name]) {
      throw new Error(`${name}: SHA-256 mismatch, delete it and download again`)
    }
    buffers.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  }
  if (pin) writeFileSync(CHECKSUMS, JSON.stringify(found, null, 2) + '\n')
  return buffers
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await loadKernelFiles(process.argv.includes('--pin'))
  console.log('kernels ok')
}
