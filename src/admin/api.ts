import { admin } from './client'
import { preparePhoto } from './photos'
import type { Coin, CoinImage, CoinReference, Json } from '../types/coin'
export type ImportResult = {
  fields: Record<string, string | number>
  source_url: string
  warnings: string[]
}
export type SaveRequest = {
  submission: string
  coin: Record<string, Json>
  images: Omit<CoinImage, 'id' | 'coin_id'>[]
  references: Omit<CoinReference, 'id' | 'coin_id'>[]
}
export async function listAdminCoins() {
  const { data, error } = await admin()
    .from('coins')
    .select('*,coin_images(*),coin_references(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Coin[]
}
export async function loadAdminCoin(id: string) {
  const { data, error } = await admin()
    .from('coins')
    .select('*,coin_images(*),coin_references(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as Coin
}
export async function retrieveInformation(url: string): Promise<ImportResult> {
  const parsed = new URL(url)
  if (!['https:', 'http:'].includes(parsed.protocol))
    throw new Error('Enter a public HTTP or HTTPS reference URL.')
  const { data, error } = await admin().functions.invoke('import-coin', {
    body: { url },
  })
  if (error)
    throw new Error(
      'Information could not be retrieved. Enter the coin details manually.',
    )
  return data as ImportResult
}
export async function cleanupPhotos() {
  const client = admin()
  const { data, error } = await client
    .from('photo_cleanup')
    .select('*')
    .lte('retry_after', new Date().toISOString())
  if (error) throw error
  let failed = 0
  for (const item of data ?? []) {
    // Never remove a file still referenced by an existing coin.
    const { data: used, error: checkError } = await client
      .from('coin_images')
      .select('id')
      .or(`image_path.eq.${item.path},thumbnail_path.eq.${item.path}`)
    if (checkError) {
      failed++
      continue
    }
    if (used?.length) {
      const { error: clearError } = await client
        .from('photo_cleanup')
        .delete()
        .eq('path', item.path)
      if (clearError) failed++
      continue
    }
    const { error: storageError } = await client.storage
      .from('coin-photos')
      .remove([item.path])
    if (storageError) {
      failed++
      await client
        .from('photo_cleanup')
        .update({ last_error: storageError.message })
        .eq('path', item.path)
    } else {
      const { error: clearError } = await client
        .from('photo_cleanup')
        .delete()
        .eq('path', item.path)
      if (clearError) failed++
    }
  }
  return failed
}
export async function uploadPhoto(
  coinId: string,
  side: 'obverse' | 'reverse',
  file: File,
  name: string,
) {
  const prepared = await preparePhoto(file)
  const prefix = `${coinId}/${crypto.randomUUID()}-${side}`
  const paths = [`${prefix}.webp`, `${prefix}-thumb.webp`]
  const { error: queueError } = await admin()
    .from('photo_cleanup')
    .insert(
      paths.map((path) => ({
        path,
        retry_after: new Date(Date.now() + 86400000).toISOString(),
      })),
    )
  if (queueError) throw queueError
  try {
    for (const [index, blob] of [prepared.full, prepared.thumbnail].entries()) {
      const { error } = await admin()
        .storage.from('coin-photos')
        .upload(paths[index], blob, {
          contentType: 'image/webp',
          upsert: false,
        })
      if (error) throw error
    }
    return {
      side,
      image_path: paths[0],
      thumbnail_path: paths[1],
      alt_text: `${name} — ${side}`,
      credit: 'Collection owner photograph',
      display_order: side === 'obverse' ? 0 : 1,
    }
  } catch (error) {
    await admin()
      .from('photo_cleanup')
      .update({ retry_after: new Date().toISOString() })
      .in('path', paths)
    await cleanupPhotos().catch(() => undefined)
    throw error
  }
}
export async function saveCoin(request: SaveRequest) {
  const { data, error } = await admin().rpc('save_coin', {
    p_submission_id: request.submission,
    p_coin: request.coin,
    p_images: request.images as unknown as Json,
    p_references: request.references as unknown as Json,
  })
  if (error) throw error
  return data
}
export async function setPublished(id: string, published: boolean) {
  const { error } = await admin()
    .from('coins')
    .update({ is_published: published })
    .eq('id', id)
  if (error) throw error
}
export async function deleteCoin(id: string) {
  const { error } = await admin().from('coins').delete().eq('id', id)
  if (error) throw error
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : 'The operation failed. Please try again.'
}

export async function releaseUncommittedPhotos(paths: string[]) {
  if (!paths.length) return
  const { error } = await admin()
    .from('photo_cleanup')
    .update({ retry_after: new Date().toISOString() })
    .in('path', paths)
  if (error) throw error
  await cleanupPhotos()
}
