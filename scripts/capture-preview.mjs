import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const folder = 'test-results/previews'
await mkdir(folder, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  })
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForSelector('.coin-card')
  await page.screenshot({ path: folder + '/home-desktop.png', fullPage: true })
  await page.goto('http://127.0.0.1:5173/collection')
  await page.waitForSelector('.coin-card')
  await page.screenshot({
    path: folder + '/collection-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForSelector('.coin-card')
  await page.screenshot({ path: folder + '/home-mobile.png', fullPage: true })
  console.log('Saved preview screenshots to ' + folder)
} finally {
  await browser.close()
}
