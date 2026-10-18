import { test, expect } from '../fixtures.js'
import {
  seedProjects,
  openProject,
  expectScreenshot,
  phone
} from '../scenes.js'

// Screenshots of the admin on phones, where the menu and the sidebar open as
// overlays, and everything has to fit the window.

test.describe('phone screenshots', () => {
  test.use(phone)
  test.beforeEach(() => seedProjects())

  test('list', async ({ page, url }) => {
    await page.goto(`${url}/admin/projects`)
    await expect(page.getByText('Website Relaunch')).toBeVisible()
    await expectScreenshot(page, 'phone-list.png')
  })

  test('list wider than the window', async ({ page, url }) => {
    await page.goto(`${url}/admin/reports/planned`)
    await expect(page.getByText('Mobile App')).toBeVisible()
    await expectScreenshot(page, 'phone-list-wide.png')
  })

  test('form', async ({ page, url }) => {
    await openProject(page, url)
    await expectScreenshot(page, 'phone-form.png')
  })

  test('menu overlay', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Close Menu', exact: true })
    ).toBeVisible()
    await expectScreenshot(page, 'phone-menu.png')
  })

  test('sidebar overlay', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByRole('button', { name: 'Sidebar', exact: true }).click()
    await expect(page.getByText('Owner: Ada')).toBeVisible()
    await expectScreenshot(page, 'phone-sidebar.png')
  })

  test('dialog', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByRole('button', { name: 'Open Dialog' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectScreenshot(page, 'phone-dialog.png')
  })
})
