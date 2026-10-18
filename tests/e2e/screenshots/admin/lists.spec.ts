import { test, expect } from '../fixtures.js'
import { seedProjects, openProject } from '../scenes.js'

test.describe('lists', () => {
  test.beforeEach(() => seedProjects())

  test('show the popups of nested lists outside their tables', async ({
    page,
    url
  }) => {
    await openProject(page, url, 'Extras')
    const noteTexts = page.getByLabel('Note Text', { exact: true })
    const count = await noteTexts.count()
    await page.getByRole('button', { name: 'Add', exact: true }).last().click()
    const note = page.getByRole('menuitem', { name: 'Note', exact: true })
    await expect(note).toBeVisible()
    // Clipped by their table, the menu would be hidden by what comes after it:
    const { x, y, width, height } = (await note.boundingBox())!
    expect(
      await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.textContent,
        [x + width / 2, y + height / 2]
      )
    ).toBe('Note')
    await note.click()
    await expect(noteTexts).toHaveCount(count + 1)
  })
})
