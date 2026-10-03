import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
const [input, output, coinId, side] = process.argv.slice(2)
if (
  !input ||
  !output ||
  !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(coinId ?? '') ||
  !['obverse', 'reverse', 'edge', 'other'].includes(side)
) {
  console.error(
    'Usage: npm run photos -- INPUT OUTPUT_FOLDER COIN_UUID obverse|reverse|edge|other',
  )
  process.exit(1)
}
const source = resolve(input),
  folder = join(resolve(output), coinId)
const metadata = await sharp(source).metadata()
if (!['jpeg', 'png', 'webp'].includes(metadata.format))
  throw new Error('Use a JPEG, PNG or WebP photograph.')
await mkdir(folder, { recursive: true })
const stem = randomUUID() + '-' + side
await sharp(source)
  .rotate()
  .resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true,
  })
  .webp({ quality: 82 })
  .toFile(join(folder, stem + '.webp'))
await sharp(source)
  .rotate()
  .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 76 })
  .toFile(join(folder, stem + '-thumb.webp'))
console.log('Upload these files to the coin-photos bucket:')
console.log('image_path: ' + coinId + '/' + stem + '.webp')
console.log('thumbnail_path: ' + coinId + '/' + stem + '-thumb.webp')
console.log(
  'Original preserved. Metadata stripped; orientation corrected. Inspect images before publishing.',
)
