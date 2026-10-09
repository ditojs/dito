import { test, expect } from '../fixtures.js'
import { seedProjects, openProject, expectScreenshot } from '../scenes.js'

// Screenshots of the admin's styling, compared against the baselines in
// `__screenshots__`. They run in the browser of the Playwright Docker image,
// so that they render the same everywhere, see `pnpm -C tests screenshots`.

test.describe('screenshots', () => {
  // 'Legacy' isn't among the options anymore.
  test.beforeEach(() =>
    seedProjects({ tags: ['Design', 'Frontend', 'Legacy'] })
  )

  test('list', async ({ page, url }) => {
    await page.goto(`${url}/admin/projects`)
    // Two projects per page, with the scopes and the filter above them.
    await expect(page.getByText('Website Relaunch')).toBeVisible()
    await expectScreenshot(page, 'list.png')
  })

  test('form', async ({ page, url }) => {
    await openProject(page, url)
    await expectScreenshot(page, 'form.png')
  })

  test('form with editors and sections', async ({ page, url }) => {
    await openProject(page, url, 'Details')
    await expect(page.getByText('all teams')).toBeVisible()
    await expectScreenshot(page, 'form-details.png')
  })

  test('form with lists and trees', async ({ page, url }) => {
    await openProject(page, url, 'Planning')
    await expect(page.getByText('Interviews')).toBeVisible()
    await expectScreenshot(page, 'form-planning.png')
  })

  test('tree items with their buttons', async ({ page, url }) => {
    await openProject(page, url, 'Planning')
    await page
      .locator('.dito-tree-header')
      .filter({ hasText: 'Research' })
      .hover()
    await expect(
      page.getByRole('button', { name: 'Remove' }).first()
    ).toBeVisible()
    await expectScreenshot(page, 'tree-hover.png')
  })

  test('nested form', async ({ page, url }) => {
    await page.goto(`${url}/admin/projects/1/milestones/0`)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Design'
    )
    await expectScreenshot(page, 'form-nested.png')
  })

  test('validation errors', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByLabel('Name', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // The errors are displayed as tooltips, see `DitoErrors`.
    await expect(page.locator('.dito-errors')).toContainText(/required/)
    await expectScreenshot(page, 'form-errors.png')
  })

  test('multiselect', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByRole('combobox', { name: 'Tags' }).click()
    await expect(page.getByRole('option', { name: 'Research' })).toBeVisible()
    await expectScreenshot(page, 'multiselect.png')
  })

  test('color picker', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByLabel('Color', { exact: true }).click()
    await expect(page.getByLabel('Sketch color picker')).toBeVisible()
    await expectScreenshot(page, 'color-picker.png')
  })

  test('dialog', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByRole('button', { name: 'Open Dialog' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectScreenshot(page, 'dialog.png')
  })
})
