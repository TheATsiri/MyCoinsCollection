import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CollectionUpdates from '../src/components/CollectionUpdates'
const realtime = vi.hoisted(() => ({
  message: undefined as undefined | (() => void),
  status: undefined as undefined | ((status: string) => void),
  remove: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (_type: string, _filter: unknown, callback: () => void) => {
          realtime.message = callback
          return channel
        },
        subscribe: (callback: (status: string) => void) => {
          realtime.status = callback
          return channel
        },
      }
      return channel
    },
    removeChannel: realtime.remove,
  },
}))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
it('refreshes public queries on broadcasts, reconnects and fallback polling without querying private admin state', async () => {
  vi.useFakeTimers()
  const client = new QueryClient(),
    invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
  render(
    <QueryClientProvider client={client}>
      <CollectionUpdates />
    </QueryClientProvider>,
  )
  act(() => realtime.status?.('SUBSCRIBED'))
  act(() => {
    realtime.message?.()
    realtime.message?.()
    vi.advanceTimersByTime(150)
  })
  expect(invalidate).toHaveBeenCalledTimes(1)
  const options = invalidate.mock.calls[0][0]!
  const predicate = options.predicate!
  expect(predicate({ queryKey: ['coins'] } as never)).toBe(true)
  expect(predicate({ queryKey: ['admin-coins'] } as never)).toBe(false)
  act(() => {
    realtime.status?.('CHANNEL_ERROR')
    vi.advanceTimersByTime(30_150)
  })
  expect(invalidate).toHaveBeenCalledTimes(2)
  act(() => {
    realtime.status?.('SUBSCRIBED')
    vi.advanceTimersByTime(150)
  })
  expect(invalidate).toHaveBeenCalledTimes(3)
})
