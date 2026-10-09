import type { Page } from '@playwright/test'
import { expect } from './fixtures.js'
import { Project } from './models/Project.js'

// The data and helpers shared by the screenshot specs, so that they all show
// the same projects.

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

// Inserts the edited project, with `overrides` applied, and two more projects
// for the list and its scopes.
export async function seedProjects(overrides: Partial<Project> = {}) {
  await Project.query().insert({ ...project, ...overrides })
  await Project.query().insert({ id: 2, name: 'Mobile App', status: 'Planned' })
  await Project.query().insert({ id: 3, name: 'Archive', status: 'Done' })
}

// Opens the form of the edited project, and selects its `tab` if provided.
export async function openProject(page: Page, url: string, tab?: string) {
  await page.goto(`${url}/admin/projects/1`)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
    'Website Relaunch'
  )
  if (tab) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
  }
}

// Waits for fonts and pending requests, so that the screenshots are stable.
// `toHaveScreenshot()` finishes transitions and animations itself, e.g. of
// menus, pickers and notifications. The screenshots capture the viewport, as
// the admin scrolls its own containers instead of the page.
export async function expectScreenshot(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot(name)
}
