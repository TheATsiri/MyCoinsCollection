import { afterEach, describe, expect, it, vi } from 'vitest'
import { preparePhoto, MAX_INPUT_BYTES } from '../src/admin/photos'
afterEach(() => vi.unstubAllGlobals())
describe('photo processing', () => {
  it('rejects unsupported and oversized inputs before decoding', async () => {
    const decoder = vi.fn()
    vi.stubGlobal('createImageBitmap', decoder)
    await expect(
      preparePhoto(new File(['x'], 'coin.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('JPEG')
    const file = new File(['x'], 'coin.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: MAX_INPUT_BYTES + 1 })
    await expect(preparePhoto(file)).rejects.toThrow('20 MB')
    expect(decoder).not.toHaveBeenCalled()
  })
  it('corrects orientation, resizes without cropping, and releases the bitmap', async () => {
    const close = vi.fn(),
      decode = vi.fn().mockResolvedValue({ width: 3200, height: 2400, close })
    vi.stubGlobal('createImageBitmap', decode)
    const draw = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: draw,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback) {
        callback(new Blob(['webp'], { type: 'image/webp' }))
      },
    )
    const file = new File(['source'], 'coin.jpg', { type: 'image/jpeg' })
    const result = await preparePhoto(file)
    expect(decode).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    })
    expect(draw.mock.calls.map((call) => call.slice(3))).toEqual([
      [1600, 1200],
      [400, 300],
    ])
    expect(result.full.type).toBe('image/webp')
    expect(close).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
