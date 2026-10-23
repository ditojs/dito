import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { seedProjects, expectScreenshot } from '../scenes.js'

// Screenshots of pages with Vue components: a page with a form of widgets,
// a page without a form, and a form of `useDitoForm()` in a dialog.

async function openPlan(page: Page, url: string, path = '') {
  await page.goto(`${url}/admin/project-plans/1${path}`)
  await expect(page.getByText('cover.png')).toBeVisible()
  await expect(page.getByText('Interviews')).toBeVisible()
}

test.describe('page screenshots', () => {
  test.beforeEach(() =>
    seedProjects({
      phases: [
        {
          name: 'Research',
          lead: 'Ada',
          tasks: [{ name: 'Interviews' }, { name: 'Survey' }]
        },
        { name: 'Build', tasks: [{ name: 'Prototype' }] }
      ]
    })
  )

  test('page with widgets', async ({ page, url }) => {
    await openPlan(page, url)
    await expectScreenshot(page, 'page.png')
  })

  test('page with widgets at a narrow width', async ({ page, url }) => {
    await page.setViewportSize({ width: 640, height: 1000 })
    await openPlan(page, url)
    await expectScreenshot(page, 'page-narrow.png')
  })

  test('page with the form of a tree item', async ({ page, url }) => {
    await openPlan(page, url, '/phases/0')
    await expect(page.getByLabel('Phase Name')).toHaveValue('Research')
    await expectScreenshot(page, 'page-tree-form.png')
  })

  test('page without a form', async ({ page, url }) => {
    await page.goto(`${url}/admin/project-guides/1`)
    await expect(page.getByText('Project Guide')).toBeVisible()
    await expectScreenshot(page, 'page-without-form.png')
    await page.getByText('The end of the guide.').scrollIntoViewIfNeeded()
    await expectScreenshot(page, 'page-without-form-end.png')
  })

  test('form in a dialog', async ({ page, url }) => {
    await openPlan(page, url)
    await page.getByRole('button', { name: 'Edit Settings' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Reviewer')).toHaveValue('Grace')
    await expectScreenshot(page, 'page-dialog.png')
  })
})
