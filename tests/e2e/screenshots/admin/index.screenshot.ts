import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Project } from '../models/Project.js'

// Screenshots of the admin's styling, compared against the baselines in
// `__screenshots__`. They run in the browser of the Playwright Docker image,
// so that they render the same everywhere, see `pnpm test:screenshots`.

const project: Partial<Project> = {
  id: 1,
  name: 'Website Relaunch',
  description: 'A new website, with a new design and a new backend.',
  budget: 12000,
  status: 'Active',
  // 'Legacy' isn't among the options anymore.
  tags: ['Design', 'Frontend', 'Legacy'],
  priority: 'High',
  features: ['Search', 'Sharing'],
  active: true,
  archived: false,
  progress: 40,
  color: '#3366ff',
  startDate: '2026-05-14',
  notes: '<p>Kick-off with <b>all teams</b> on Monday.</p>',
  config: '{\n  "theme": "dark"\n}',
  contacts: [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Grace Hopper', email: 'grace@example.com' }
  ],
  milestones: [
    { title: 'Design', due: '2026-06-01' },
    { title: 'Launch', due: '2026-09-01' }
  ],
  phases: [
    { name: 'Research', tasks: [{ name: 'Interviews' }, { name: 'Survey' }] },
    { name: 'Build', tasks: [{ name: 'Prototype' }] }
  ],
  settings: { visibility: 'Private', reviewer: 'Grace' }
}

async function seedProjects() {
  await Project.query().insert(project)
  await Project.query().insert({ id: 2, name: 'Mobile App', status: 'Planned' })
  await Project.query().insert({ id: 3, name: 'Archive', status: 'Done' })
}

async function openProject(page: Page, url: string) {
  await page.goto(`${url}/admin/projects/1`)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
    'Website Relaunch'
  )
}

async function selectTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click()
}

// Waits for fonts and pending requests, so that the screenshots are stable.
// The screenshots capture the viewport, as the admin scrolls its own
// containers instead of the page.
async function expectScreenshot(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot(name)
}

test.describe('screenshots', () => {
  test.beforeEach(seedProjects)

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
    await openProject(page, url)
    await selectTab(page, 'Details')
    await expect(page.getByText('all teams')).toBeVisible()
    await expectScreenshot(page, 'form-details.png')
  })

  test('form with lists and trees', async ({ page, url }) => {
    await openProject(page, url)
    await selectTab(page, 'Planning')
    await expect(page.getByText('Interviews')).toBeVisible()
    await expectScreenshot(page, 'form-planning.png')
  })

  test('tree items with their buttons', async ({ page, url }) => {
    await openProject(page, url)
    await selectTab(page, 'Planning')
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
