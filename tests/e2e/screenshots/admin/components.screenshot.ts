import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Project } from '../models/Project.js'

// Screenshots of the admin's components in their various states: open menus
// and pickers, keyboard focus, dialogs, notifications, errors and narrow
// viewports. The selectors only use roles, labels and texts, so that the
// scenes don't depend on the markup of a particular version.

const project: Partial<Project> = {
  id: 1,
  name: 'Website Relaunch',
  description: 'A new website, with a new design and a new backend.',
  budget: 12000,
  status: 'Active',
  tags: ['Design', 'Frontend'],
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
  settings: { visibility: 'Private', reviewer: 'Grace' },
  website: 'https://example.com',
  startTime: '2026-05-14T07:30:00.000Z',
  meetingAt: '2026-05-20T12:15:00.000Z',
  contactInfo: { phone: '+41 44 000 00 00', email: 'team@example.com' },
  files: [
    { key: 'a.png', name: 'cover.png', type: 'image/png', size: 24576 },
    { key: 'b.pdf', name: 'brief.pdf', type: 'application/pdf', size: 1048576 }
  ],
  links: [
    { type: 'link', url: 'https://example.com/docs' },
    { type: 'note', text: 'Ask Ada about the fonts' }
  ]
}

async function seedProjects() {
  await Project.query().insert(project)
  await Project.query().insert({ id: 2, name: 'Mobile App', status: 'Planned' })
  await Project.query().insert({ id: 3, name: 'Archive', status: 'Done' })
}

async function openProject(page: Page, url: string, tab?: string) {
  await page.goto(`${url}/admin/projects/1`)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
    'Website Relaunch'
  )
  if (tab) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
  }
}

function visible(locator: Locator) {
  return locator.filter({ visible: true })
}

// Moves the focus to `locator` after a key press, so that browsers match
// `:focus-visible` as with keyboard navigation.
async function focusByKeyboard(page: Page, locator: Locator) {
  await page.keyboard.press('Shift')
  await locator.focus()
}

async function expectScreenshot(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // Let transitions of menus, pickers and notifications finish.
  await page.waitForTimeout(500)
  await expect(page).toHaveScreenshot(name)
}

test.describe('component screenshots', () => {
  test.beforeEach(seedProjects)

  test('extras tab', async ({ page, url }) => {
    await openProject(page, url, 'Extras')
    await expect(page.getByText('cover.png')).toBeVisible()
    await expectScreenshot(page, 'extras.png')
  })

  test('create menu with multiple forms', async ({ page, url }) => {
    await openProject(page, url, 'Extras')
    await visible(page.getByRole('button', { name: /^(Create|Add)/ }))
      .last()
      .click()
    await expect(visible(page.getByText('Note', { exact: true }))).toHaveCount(
      1
    )
    await expectScreenshot(page, 'create-menu.png')
  })

  test('account menu', async ({ page, url }) => {
    await openProject(page, url)
    // The stub user has no username, so the account button has no text.
    await page.getByRole('complementary').getByRole('button').first().click()
    await expect(page.getByText('Logout', { exact: true })).toBeVisible()
    await expectScreenshot(page, 'account-menu.png')
  })

  test('date picker', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByLabel('Start Date', { exact: true }).click()
    await expectScreenshot(page, 'date-picker.png')
  })

  test('date picker by keyboard', async ({ page, url }) => {
    await openProject(page, url)
    const input = page.getByLabel('Start Date', { exact: true })
    await focusByKeyboard(page, input)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expectScreenshot(page, 'date-picker-keyboard.png')
  })

  test('time picker', async ({ page, url }) => {
    await openProject(page, url, 'Extras')
    await page.getByLabel('Start Time', { exact: true }).click()
    await expectScreenshot(page, 'time-picker.png')
  })

  test('datetime picker', async ({ page, url }) => {
    await openProject(page, url, 'Extras')
    await page.getByLabel('Meeting', { exact: true }).click()
    await expectScreenshot(page, 'datetime-picker.png')
  })

  test('drag handle focus in inline list', async ({ page, url }) => {
    await openProject(page, url, 'Planning')
    await focusByKeyboard(
      page,
      visible(page.getByLabel('Drag', { exact: true })).first()
    )
    await expectScreenshot(page, 'drag-handle-focus.png')
  })

  test('upload with drag handle focus', async ({ page, url }) => {
    await openProject(page, url, 'Extras')
    await expect(page.getByText('brief.pdf')).toBeVisible()
    await page.getByText('cover.png').hover()
    await expectScreenshot(page, 'upload-hover.png')
  })

  test('markup toolbar', async ({ page, url }) => {
    await openProject(page, url, 'Details')
    await page.getByText('all teams').dblclick()
    await expectScreenshot(page, 'markup-toolbar.png')
  })

  test('code editor focus', async ({ page, url }) => {
    await openProject(page, url, 'Details')
    // The code editor isn't labelled, so click into it below its label.
    const label = await page.getByText('Config', { exact: true }).boundingBox()
    await page.mouse.click(label!.x + 100, label!.y + label!.height + 30)
    await expectScreenshot(page, 'code-focus.png')
  })

  test('code editor resize handle focus', async ({ page, url }) => {
    await openProject(page, url, 'Details')
    const handle = page.getByRole('separator', { name: 'Resize' })
    test.skip(
      (await handle.count()) === 0,
      'The resize handle is not focusable before the session'
    )
    await focusByKeyboard(page, handle.first())
    await expectScreenshot(page, 'code-resize-focus.png')
  })

  test('tab keyboard focus', async ({ page, url }) => {
    await openProject(page, url)
    await focusByKeyboard(
      page,
      page.getByRole('tab', { name: 'Details', exact: true })
    )
    await expectScreenshot(page, 'tab-focus.png')
  })

  test('section labels and inline errors', async ({ page, url }) => {
    await openProject(page, url, 'Extras')
    await page.getByLabel('Website', { exact: true }).fill('not a url')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(visible(page.getByText(/URL/)).first()).toBeVisible()
    await expectScreenshot(page, 'extras-errors.png')
  })

  test('inline errors at a narrow width', async ({ page, url }) => {
    await page.setViewportSize({ width: 640, height: 1000 })
    await openProject(page, url, 'Extras')
    await page.getByLabel('Website', { exact: true }).fill('not a url')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(visible(page.getByText(/URL/)).first()).toBeVisible()
    await page.mouse.move(0, 0)
    await expectScreenshot(page, 'extras-errors-narrow.png')
  })

  test('confirmation dialog', async ({ page, url }) => {
    let isNative = false
    page.on('dialog', dialog => {
      isNative = true
      dialog.dismiss()
    })
    await openProject(page, url, 'Planning')
    await visible(page.getByRole('button', { name: /^(Remove|Delete)/ }))
      .first()
      .click()
    await page.waitForTimeout(500)
    test.skip(isNative, 'Native confirm() before the session')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectScreenshot(page, 'confirm-dialog.png')
  })

  test('notification', async ({ page, url }) => {
    page.on('dialog', dialog => dialog.accept())
    await openProject(page, url, 'Planning')
    await visible(page.getByRole('button', { name: /^(Remove|Delete)/ }))
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible()) {
      await dialog.locator('button[type="submit"]').click()
    }
    await expect(page.getByText('Successfully Removed')).toBeVisible()
    await page.mouse.move(0, 0)
    await expectScreenshot(page, 'notification.png')
  })

  test('switch, checkbox and radio focus', async ({ page, url }) => {
    await openProject(page, url)
    await focusByKeyboard(page, page.getByLabel('Active', { exact: true }))
    await expectScreenshot(page, 'switch-focus.png')
    await focusByKeyboard(page, page.getByLabel('Archived', { exact: true }))
    await expectScreenshot(page, 'checkbox-focus.png')
    await focusByKeyboard(page, page.getByLabel('Medium', { exact: true }))
    await expectScreenshot(page, 'radio-focus.png')
    await focusByKeyboard(page, page.getByLabel('Export', { exact: true }))
    await expectScreenshot(page, 'checkboxes-focus.png')
  })

  test('slider focus', async ({ page, url }) => {
    await openProject(page, url)
    await focusByKeyboard(page, page.getByRole('slider').first())
    await expectScreenshot(page, 'slider-focus.png')
  })

  test('sub-menu on hover', async ({ page, url }) => {
    await openProject(page, url)
    await page.getByRole('link', { name: 'Reports', exact: true }).hover()
    await expect(page.getByText('Done Projects')).toBeVisible()
    await expectScreenshot(page, 'menu-hover.png')
  })

  test('menu link focus', async ({ page, url }) => {
    await openProject(page, url)
    await focusByKeyboard(
      page,
      page.getByRole('link', { name: 'Projects', exact: true }).first()
    )
    await expectScreenshot(page, 'menu-focus.png')
  })

  test('sub-menu view and trail', async ({ page, url }) => {
    await page.goto(`${url}/admin/reports/done`)
    await expect(page.getByText('Website Relaunch')).toBeVisible()
    await expectScreenshot(page, 'menu-view.png')
  })

  test('trail link focus', async ({ page, url }) => {
    await page.goto(`${url}/admin/projects/1/milestones/0`)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Design'
    )
    await focusByKeyboard(
      page,
      page
        .getByLabel('Breadcrumb')
        .getByRole('link', { name: 'Edit', exact: true })
    )
    await expectScreenshot(page, 'trail-focus.png')
  })

  test('pagination', async ({ page, url }) => {
    await page.goto(`${url}/admin/projects`)
    await expect(page.getByText('Website Relaunch')).toBeVisible()
    await page.getByRole('button', { name: 'Page 2', exact: true }).click()
    await expect(page.getByText('Archive', { exact: true })).toBeVisible()
    await expectScreenshot(page, 'pagination.png')
  })

  test('tree item focus', async ({ page, url }) => {
    await openProject(page, url, 'Planning')
    await focusByKeyboard(
      page,
      page.getByRole('button', { name: 'Research', exact: true })
    )
    await expectScreenshot(page, 'tree-focus.png')
  })

  for (const width of [900, 640]) {
    test(`narrow form ${width}`, async ({ page, url }) => {
      await page.setViewportSize({ width, height: 1000 })
      await openProject(page, url)
      await expectScreenshot(page, `narrow-form-${width}.png`)
    })

    test(`narrow extras ${width}`, async ({ page, url }) => {
      await page.setViewportSize({ width, height: 1000 })
      await openProject(page, url, 'Extras')
      await expectScreenshot(page, `narrow-extras-${width}.png`)
    })

    test(`narrow list ${width}`, async ({ page, url }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`${url}/admin/projects`)
      await expect(page.getByText('Website Relaunch')).toBeVisible()
      await expectScreenshot(page, `narrow-list-${width}.png`)
    })
  }
})
