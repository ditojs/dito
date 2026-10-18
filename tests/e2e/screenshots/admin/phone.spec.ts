import { test, expect } from '../fixtures.js'
import { seedProjects, openProject, phone } from '../scenes.js'

// The behaviour of the admin on phones, next to the screenshots of it in
// `phone.screenshot.ts`.

test.describe('phone', () => {
  test.use(phone)
  test.beforeEach(() => seedProjects())

  test('closes the overlay menu with its close button', async ({
    page,
    url
  }) => {
    await openProject(page, url)
    const toggle = page.getByRole('button', { name: 'Menu', exact: true })
    await toggle.click()
    const reports = page.getByRole('link', { name: 'Reports' })
    await expect(reports).toBeVisible()
    await page.getByRole('button', { name: 'Close Menu', exact: true }).click()
    await expect(reports).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('never widens the page beyond the window', async ({ page, url }) => {
    // Phones widen the page to content that overflows the window:
    const expectWindowWidth = () =>
      expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(phone.viewport.width)
    await page.goto(`${url}/admin/reports/planned`)
    await expect(page.getByText('Mobile App')).toBeVisible()
    await expectWindowWidth()
    await openProject(page, url)
    await expectWindowWidth()
    await page.getByRole('button', { name: 'Open Dialog' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectWindowWidth()
  })
})
