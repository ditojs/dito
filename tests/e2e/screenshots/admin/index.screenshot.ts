import { test, expect } from '../fixtures.js'
import { seedProjects, openProject, expectScreenshot } from '../scenes.js'
import { Project } from '../models/Project.js'

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

  test('row with a section without a label', async ({ page, url }) => {
    await Project.query()
      .findById(2)
      .patch({
        approved: true,
        approval: { approver: 'Grace', approvedOn: '2026-05-14' }
      })
    await page.goto(`${url}/admin/projects/2`)
    await page.getByRole('tab', { name: 'Details', exact: true }).click()
    const approver = page.getByLabel('Approver', { exact: true })
    await expect(approver).toHaveValue('Grace')
    await approver.scrollIntoViewIfNeeded()
    await expectScreenshot(page, 'form-section-row.png')
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

  test('rows and tree items with errors', async ({ page, url }) => {
    await Project.query()
      .findById(1)
      .patch({
        milestones: [
          { title: 'Design', due: '2026-06-01' },
          { title: '', due: '2026-09-01' }
        ],
        phases: [
          { name: 'Research', tasks: [{ name: 'Interviews' }, { name: '' }] },
          { name: 'Build', tasks: [{ name: 'Prototype' }] }
        ]
      })
    await openProject(page, url)
    // The first error is in the form itself, so the nested forms stay closed:
    await page.getByLabel('Name', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.dito-errors')).toContainText(/required/)
    await page.getByRole('tab', { name: 'Planning', exact: true }).click()
    await expect(page.locator('.dito-table__row--error')).toHaveCount(1)
    // The notification of the failed save times out after about 2s, which the
    // screenshot would race:
    await expect(page.getByText('Validation Errors')).toBeHidden()
    await expectScreenshot(page, 'rows-errors.png')
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
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expectScreenshot(page, 'dialog.png')
    const message = dialog.getByLabel('Message', { exact: true })
    await message.fill('Hello')
    await message.hover()
    await expect(dialog.getByRole('button', { name: 'Clear' })).toBeVisible()
    await expectScreenshot(page, 'dialog-clear.png')
  })
})
