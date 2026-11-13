import { test, expect } from '../fixtures.js'
import { seedProjects, openProject } from '../scenes.js'

test.describe('dialog', () => {
  test.beforeEach(() => seedProjects())

  test('closes with `clickToClose` on a click on the overlay', async ({
    page,
    url
  }) => {
    await openProject(page, url)
    await page.getByRole('button', { name: 'Open Dialog' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Clicks in the dialog keep it open:
    await dialog.getByLabel('Message', { exact: true }).click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(dialog).toBeHidden()
  })
})
