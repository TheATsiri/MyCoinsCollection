import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoinReviews from '../src/components/CoinReviews'
import Reviews from '../src/admin/Reviews'
import { MemoryRouter } from 'react-router-dom'
import { validateReview } from '../supabase/functions/submit-review/validation'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  submit: vi.fn(),
  list: vi.fn(),
  moderate: vi.fn(),
}))
vi.mock('../src/lib/reviews', () => ({
  getReviews: mocks.get,
  submitReview: mocks.submit,
  listReviews: mocks.list,
  moderateReview: mocks.moderate,
}))
vi.mock('../src/lib/supabase', () => ({ isDemo: false, supabase: null }))
vi.mock('../src/admin/api', () => ({
  listAdminCoins: async () => [{ id: 'coin-a', name: 'Coin A' }],
  errorMessage: (e: Error) => e.message,
}))
vi.mock('../src/components/ReviewVerification', () => ({
  default: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('verified')}>
      Verify
    </button>
  ),
}))
const empty = {
  items: [],
  total: 0,
  written_count: 0,
  average: null,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}
function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key')
  mocks.get.mockResolvedValue(empty)
  mocks.submit.mockResolvedValue(undefined)
  mocks.moderate.mockResolvedValue(undefined)
  mocks.list.mockResolvedValue({ items: [], total: 0 })
})
describe('collector reviews', () => {
  it('shows an honest empty state without an average', async () => {
    renderWithQuery(<CoinReviews coinId="coin-a" />)
    expect(
      await screen.findByText(
        'No ratings yet. Be the first to rate this coin!',
      ),
    ).toBeVisible()
    expect(screen.queryByText('/ 5')).not.toBeInTheDocument()
  })
  it('submits a keyboard-selected rating-only review against the current coin', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CoinReviews coinId="coin-a" />)
    await user.type(screen.getByLabelText('Display name'), 'Collector')
    screen.getByRole('radio', { name: '1 stars — Poor' }).focus()
    // Native radio controls retain browser keyboard behavior; use Space to select.
    await user.keyboard(' ')
    expect(screen.getByRole('radio', { name: '1 stars — Poor' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: '5 stars — Excellent' }))
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        coin_id: 'coin-a',
        rating: 5,
        review_text: '',
        display_name: 'Collector',
      }),
    )
    expect(
      await screen.findByText(
        'Thank you! Your review will appear after approval.',
      ),
    ).toBeVisible()
  })
  it('blocks missing ratings and repeated clicks while saving', async () => {
    let finish: () => void = () => {}
    mocks.submit.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const user = userEvent.setup()
    renderWithQuery(<CoinReviews coinId="coin-a" />)
    fireEvent.submit(document.querySelector('form')!)
    expect(mocks.submit).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Display name'), 'Collector')
    await user.click(screen.getByRole('radio', { name: '4 stars — Very Good' }))
    await user.type(
      screen.getByLabelText('Written review (optional)'),
      'Great specimen',
    )
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    fireEvent.submit(document.querySelector('form')!)
    fireEvent.submit(document.querySelector('form')!)
    expect(mocks.submit).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Display name')).toBeDisabled()
    finish()
    await screen.findByText(
      'Thank you! Your review will appear after approval.',
    )
  })
  it('preserves the receipt after an ambiguous error and requires new verification', async () => {
    mocks.submit.mockRejectedValueOnce(
      new Error('Review could not be saved. Please try again.'),
    )
    const user = userEvent.setup()
    renderWithQuery(<CoinReviews coinId="coin-a" />)
    await user.type(screen.getByLabelText('Display name'), 'Collector')
    await user.click(screen.getByRole('radio', { name: '5 stars — Excellent' }))
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    await screen.findByText('Review could not be saved. Please try again.')
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    await screen.findByText(
      'Thank you! Your review will appear after approval.',
    )
    expect(mocks.submit.mock.calls[1][0].submission_id).toBe(
      mocks.submit.mock.calls[0][0].submission_id,
    )
  })
  it('renders malicious text literally and fetches server sorting/pages with coin isolation', async () => {
    mocks.get.mockResolvedValue({
      ...empty,
      total: 12,
      written_count: 1,
      average: 4.7,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 4, 5: 8 },
      items: [
        {
          id: 'r1',
          display_name: '<script>evil()</script>',
          rating: 5,
          review_text: '<img src=x onerror=evil()>',
          created_at: '2026-10-10T12:00:00Z',
        },
      ],
    })
    const user = userEvent.setup()
    renderWithQuery(<CoinReviews coinId="coin-b" />)
    expect(await screen.findByText('<img src=x onerror=evil()>')).toBeVisible()
    expect(document.querySelector('.review-card img')).toBeNull()
    expect(screen.getByText('4.7')).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Sort reviews'), 'lowest')
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('coin-b', 'lowest', 1),
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('coin-b', 'lowest', 2),
    )
  })
})
describe('moderation', () => {
  it('approves a pending review using the owner API', async () => {
    mocks.list.mockResolvedValue({
      items: [
        {
          id: 'r1',
          coin_id: 'coin-a',
          coins: { name: 'Coin A' },
          display_name: 'Collector',
          rating: 5,
          status: 'pending',
          review_text: 'Nice',
          created_at: '2026-10-10T12:00:00Z',
        },
      ],
      total: 1,
    })
    const user = userEvent.setup()
    renderWithQuery(<Reviews />)
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(mocks.moderate).toHaveBeenCalledWith('r1', 'approved')
    await screen.findByText('Changes saved.')
  })
})
describe('server input validation', () => {
  const valid = {
    coin_id: '10000000-0000-0000-0000-000000000001',
    submission_id: '20000000-0000-0000-0000-000000000001',
    rating: 5,
    display_name: ' Collector ',
    review_text: '',
    website: '',
    token: 'verified',
  }
  it('accepts a rating without a comment and normalizes the name', () =>
    expect(validateReview(valid).display_name).toBe('Collector'))
  it.each([0, 6, 1.5, '5', null])('rejects invalid rating %s', (rating) =>
    expect(() => validateReview({ ...valid, rating })).toThrow(/rating/),
  )
  it.each([
    { display_name: '' },
    { display_name: 'x'.repeat(101) },
    { display_name: 'bad\nname' },
    { review_text: 'x'.repeat(2001) },
    { coin_id: 'not-a-coin' },
    { website: 'spam' },
    { token: '' },
  ])('rejects invalid or abusive fields %j', (fields) =>
    expect(() => validateReview({ ...valid, ...fields })).toThrow(),
  )
})
