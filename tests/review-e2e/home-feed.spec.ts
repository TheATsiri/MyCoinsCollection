import { expect, test } from '@playwright/test'

test('homepage shows and refreshes weekly ratings and opens all reviews', async ({
  page,
  isMobile,
}) => {
  const olderReview = {
    id: 'older',
    rating: 4,
    review_text: 'A helpful catalogue.',
    created_at: '2026-11-25T12:00:00Z',
    coin_name: 'First coin',
    coin_slug: 'first',
  }
  const latestReview = {
    ...olderReview,
    id: 'latest',
    rating: 5,
    review_text: 'A great collection.',
    created_at: '2026-11-26T12:00:00Z',
  }
  let weeklyItems: (typeof olderReview)[] = []
  let publishReviewUpdate: (() => void) | undefined
  await page.routeWebSocket(
    /reviews-test\.supabase\.co\/realtime\/v1\/websocket/,
    (socket) => {
      socket.onMessage((message) => {
        if (typeof message !== 'string') return
        const [joinRef, ref, topic, event] = JSON.parse(message)
        if (event === 'phx_join' || event === 'heartbeat') {
          socket.send(
            JSON.stringify([
              joinRef,
              ref,
              topic,
              'phx_reply',
              {
                status: 'ok',
                response: {},
              },
            ]),
          )
        }
        if (event === 'phx_join' && topic === 'realtime:public-collection') {
          publishReviewUpdate = () =>
            socket.send(
              JSON.stringify([
                joinRef,
                null,
                topic,
                'broadcast',
                { type: 'broadcast', event: 'refresh', payload: {} },
              ]),
            )
        }
      })
    },
  )
  await page.route('https://reviews-test.supabase.co/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/rpc/get_public_reviews')) {
      const { p_last_week, p_page } = route.request().postDataJSON()
      const items = p_last_week
        ? weeklyItems
        : p_page === 1
          ? [latestReview, olderReview]
          : [{ ...olderReview, id: 'archive', review_text: 'An older review.' }]
      await route.fulfill({
        json: {
          items,
          total: p_last_week ? weeklyItems.length : 11,
          average: items.length ? 4.5 : null,
        },
      })
      return
    }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.clock.install()
  await page.goto('/')
  const sidebar = page.getByRole('complementary', {
    name: 'Ratings & Reviews – Last Week',
  })
  await expect(sidebar.getByText('No reviews in the last 7 days')).toBeVisible()
  await expect.poll(() => !!publishReviewUpdate).toBe(true)
  weeklyItems = [olderReview]
  await page.clock.runFor(30_200)
  await expect(sidebar.getByText('1 review', { exact: true })).toBeVisible()

  weeklyItems = [latestReview, olderReview]
  publishReviewUpdate!()
  await page.clock.runFor(1_000)
  await expect(sidebar.getByText('4.5 / 5')).toBeVisible()
  await expect(sidebar.getByText('2 reviews')).toBeVisible()
  const reviews = sidebar.getByRole('listitem')
  await expect(reviews.nth(0)).toContainText('A great collection.')
  await expect(reviews.nth(1)).toContainText('A helpful catalogue.')
  await expect(reviews.nth(0).locator('time')).toHaveAttribute(
    'datetime',
    latestReview.created_at,
  )

  const panel = (await sidebar.boundingBox())!
  if (isMobile) {
    const closing = (await page.locator('.closing-line').boundingBox())!
    expect(panel.y).toBeGreaterThanOrEqual(closing.y + closing.height)
  } else {
    const hero = (await page.locator('.cinematic-hero').boundingBox())!
    const cabinet = (await page.locator('.home-cabinet').boundingBox())!
    expect(panel.x).toBeGreaterThan(cabinet.x + cabinet.width)
    expect(panel.y).toBeGreaterThanOrEqual(hero.y + hero.height)
    expect(panel.y).toBeLessThan(cabinet.y + cabinet.height)
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width)

  await sidebar.getByRole('link', { name: 'View All Reviews' }).click()
  await expect(page).toHaveURL(/\/reviews$/)
  await expect(page.getByRole('heading', { name: 'All Reviews' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('An older review.')).toBeVisible()
})
