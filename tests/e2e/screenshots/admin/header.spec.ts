import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { seedProjects, openProject } from '../scenes.js'

// Collects the right edges of the account in every frame, to also catch it
// moving while the sidebar slides:
function trackAccountEdges(page: Page) {
  return page.evaluate(() => {
    const account = document.querySelector('.dito-account')!
    const edges = new Set<number>()
    const track = () => {
      edges.add(Math.round(account.getBoundingClientRect().right))
      requestAnimationFrame(track)
    }
    track()
    window.accountEdges = edges
  })
}

// Read the edges after the next frame, so it includes the last change:
function getAccountEdges(page: Page) {
  return page.evaluate(async () => {
    await new Promise(requestAnimationFrame)
    return [...window.accountEdges!]
  })
}

declare global {
  interface Window {
    accountEdges?: Set<number>
  }
}

test.describe('header', () => {
  test.beforeEach(() => seedProjects())

  for (const width of [1600, 900]) {
    test(`keeps the account next to the sidebar's toggle at ${width}`, async ({
      page,
      url
    }) => {
      await page.setViewportSize({ width, height: 1000 })
      await openProject(page, url)
      const toggle = page.getByRole('button', { name: 'Sidebar', exact: true })
      const { x } = (await toggle.boundingBox())!
      const panel = page.getByText('Owner: Ada')
      await trackAccountEdges(page)
      await toggle.click()
      await expect(page.locator('.dito-root--sliding-sidebar')).toHaveCount(0)
      await expect(panel).toBeVisible({ visible: width < 1200 })
      await toggle.click()
      await expect(page.locator('.dito-root--sliding-sidebar')).toHaveCount(0)
      await expect(panel).toBeVisible({ visible: width >= 1200 })
      // A view without panels keeps the room of the hidden toggle:
      await page.getByRole('button', { name: 'test', exact: true }).click()
      await page.getByText('Settings', { exact: true }).click()
      await expect(toggle).toBeHidden()
      expect(await getAccountEdges(page)).toEqual([x])
    })
  }
})
