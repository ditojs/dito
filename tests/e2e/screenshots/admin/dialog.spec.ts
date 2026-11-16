import { test, expect } from '../fixtures.js'
import { seedProjects, openProject } from '../scenes.js'

test.describe('dialog', () => {
  test.beforeEach(() => seedProjects())

  test('closes with `clickToClose` and returns the focus to its button', async ({
    page,
    url
  }) => {
    await openProject(page, url)
    const button = page.getByRole('button', { name: 'Open Dialog' })
    await button.click()
    const dialog = page.getByRole('dialog')
    // Clicks in the dialog keep it open:
    await dialog.getByLabel('Message', { exact: true }).click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
  })
})
