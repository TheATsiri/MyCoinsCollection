import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CoinCarousel from '../src/components/CoinCarousel'
import { demoCoins } from '../src/features/coins/demo'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function setup() {
  render(
    <MemoryRouter>
      <CoinCarousel coins={demoCoins} />
    </MemoryRouter>,
  )
  const track = screen.getByLabelText('Browse coins with the arrow keys')
  Object.defineProperties(track, {
    scrollWidth: { value: 10000 },
    clientWidth: { value: 400 },
  })
  return track
}
function advance() {
  act(() => vi.advanceTimersByTime(100))
}
function enterPointer(target: HTMLElement, pointerType: string) {
  const event = new Event('pointerover', { bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  fireEvent(target, event)
}
it('continues after touch hover and resumes after a swipe ends', () => {
  const track = setup()
  enterPointer(track, 'touch')
  advance()
  expect(track.scrollLeft).toBeGreaterThan(0)
  fireEvent.touchStart(track)
  const paused = track.scrollLeft
  advance()
  expect(track.scrollLeft).toBe(paused)
  fireEvent.touchEnd(track)
  act(() => vi.advanceTimersByTime(600))
  advance()
  expect(track.scrollLeft).toBeGreaterThan(paused)
})
it('resumes after a cancelled touch but preserves an explicit pause', () => {
  const track = setup()
  fireEvent.touchStart(track)
  fireEvent.touchCancel(track)
  act(() => vi.advanceTimersByTime(600))
  advance()
  expect(track.scrollLeft).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }))
  const paused = track.scrollLeft
  fireEvent.touchStart(track)
  fireEvent.touchEnd(track)
  act(() => vi.advanceTimersByTime(600))
  advance()
  expect(track.scrollLeft).toBe(paused)
})
it('still pauses on mouse hover', () => {
  const track = setup()
  advance()
  const paused = track.scrollLeft
  enterPointer(track, 'mouse')
  advance()
  expect(track.scrollLeft).toBe(paused)
})

it('autoplays on phones reporting reduced motion and still allows pausing', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const track = setup()
  advance()
  expect(track.scrollLeft).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }))
  const paused = track.scrollLeft
  advance()
  expect(track.scrollLeft).toBe(paused)
  expect(
    screen.getByRole('button', { name: 'Play slideshow' }),
  ).toBeInTheDocument()
})
