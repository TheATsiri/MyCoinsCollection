import { test, expect } from '@playwright/test'
import { demoCoins } from '../../src/features/coins/demo'
test('review summary and form support keyboard, touch, safe text and coin-linked submission', async ({
  page,
  isMobile,
}) => {
  const coin = {
    ...demoCoins[0],
    id: '10000000-0000-0000-0000-000000000001',
    slug: 'review-test',
    coin_images: [],
    coin_references: [],
  }
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js*',
    (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.turnstile={render:(node,options)=>{const button=document.createElement('button');button.type='button';button.textContent='Verify test challenge';button.onclick=()=>options.callback('test-token');node.append(button);return 'test-widget'},remove:()=>{}};`,
      }),
  )
  let posted: Record<string, unknown> | undefined
  await page.route('https://reviews-test.supabase.co/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/functions/v1/submit-review')) {
      posted = route.request().postDataJSON()
      await route.fulfill({ status: 201, json: { status: 'pending' } })
      return
    }
    if (url.includes('/rpc/get_coin_reviews')) {
      await route.fulfill({
        json: {
          items: [
            {
              id: 'review',
              display_name: 'Collector',
              rating: 5,
              review_text: '<img src=x onerror=alert(1)>',
              created_at: '2026-10-10T12:00:00Z',
            },
          ],
          total: 1,
          written_count: 1,
          average: 5,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
        },
      })
      return
    }
    if (url.includes('/rest/v1/coins')) {
      await route.fulfill({ json: coin })
      return
    }
    await route.fulfill({ json: [] })
  })
  await page.goto('/coins/review-test')
  const region = page.getByRole('region', { name: 'Ratings & reviews' })
  await region.scrollIntoViewIfNeeded()
  await expect(region.getByText('<img src=x onerror=alert(1)>')).toBeVisible()
  await expect(region.locator('.review-card img')).toHaveCount(0)
  const radio = region.getByRole('radio', { name: '1 stars — Poor' })
  if (isMobile)
    await region.getByRole('radio', { name: '5 stars — Excellent' }).tap()
  else {
    await radio.focus()
    await page.keyboard.press('ArrowRight')
    await expect(
      region.getByRole('radio', { name: '2 stars — Fair' }),
    ).toBeChecked()
    await page.keyboard.press('End')
    await region.getByRole('radio', { name: '5 stars — Excellent' }).check()
  }
  await region.getByLabel('Display name').fill('Keyboard collector')
  await region
    .getByLabel('Written review (optional)')
    .fill('A remarkable specimen')
  await region.getByRole('button', { name: 'Verify test challenge' }).click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await region.screenshot({
    path: `test-results/reviews-${isMobile ? 'mobile' : 'desktop'}.png`,
  })
  await region.getByRole('button', { name: 'Submit review' }).click()
  await expect(
    region.getByText('Thank you! Your review will appear after approval.'),
  ).toBeVisible()
  expect(posted).toMatchObject({
    coin_id: coin.id,
    rating: 5,
    display_name: 'Keyboard collector',
    review_text: 'A remarkable specimen',
  })
})
