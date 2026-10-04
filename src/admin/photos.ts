export const MAX_INPUT_BYTES = 20 * 1024 * 1024
export async function preparePhoto(
  file: File,
): Promise<{ full: Blob; thumbnail: Blob }> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    !file.size ||
    file.size > MAX_INPUT_BYTES
  )
    throw new Error('Choose a JPEG, PNG or WebP photograph up to 20 MB.')
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  }).catch(() => {
    throw new Error(
      'Could not decode the photograph. Choose a valid JPEG, PNG or WebP.',
    )
  })
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 100_000_000
    )
      throw new Error('Photograph dimensions are too large.')
    const render = async (limit: number) => {
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Photograph processing is unavailable.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.88, 0.75, 0.6]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/webp', quality),
        )
        if (blob?.type === 'image/webp' && blob.size <= 2 * 1024 * 1024)
          return blob
      }
      throw new Error('Could not prepare a photograph within the upload limit.')
    }
    return { full: await render(1600), thumbnail: await render(400) }
  } finally {
    bitmap.close()
  }
}
