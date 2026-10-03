import sharp from 'sharp'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const folder = join('test-results', 'photo-' + randomUUID())
await mkdir(folder, { recursive: true })
const input = join(folder, 'input.jpg')
await sharp({
  create: { width: 2400, height: 1400, channels: 3, background: '#af9270' },
})
  .jpeg()
  .withMetadata({ orientation: 6 })
  .toFile(input)
const hash = async () =>
  createHash('sha256')
    .update(await readFile(input))
    .digest('hex')
const before = await hash(),
  coinId = randomUUID()
const result = spawnSync(
  process.execPath,
  ['scripts/prepare-photos.mjs', input, folder, coinId, 'obverse'],
  { encoding: 'utf8' },
)
assert.equal(result.status, 0, result.stderr)
const exports = await readdir(join(folder, coinId))
assert.equal(exports.length, 2)
for (const file of exports) {
  const metadata = await sharp(join(folder, coinId, file)).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(
    Math.max(metadata.width, metadata.height),
    file.includes('thumb') ? 400 : 1600,
  )
  assert.ok(
    metadata.height > metadata.width,
    'EXIF orientation must be applied',
  )
  assert.equal(metadata.exif, undefined)
}
assert.equal(await hash(), before, 'Original must remain unchanged')
console.log(
  'PASS: photograph sizing, orientation, metadata stripping and preservation of originals',
)
