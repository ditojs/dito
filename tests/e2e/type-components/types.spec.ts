import type { Page } from '@playwright/test'
import { test, expect } from './fixtures.js'
import { Case } from './models/Case.js'
import { caseEntries } from './cases/index.js'
import type { CaseEntry } from './cases/define.js'
import { getDriver } from '../../utils/drivers/index.js'

async function openCase(page: Page, url: string, entry: CaseEntry) {
  await page.goto(`${url}/admin/${entry.path}`)
  await expect(getDriver(entry.type).getElement(page, entry)).toBeVisible()
}

function getSaveButton(page: Page) {
  return page.getByRole('button', { name: 'Save', exact: true })
}

async function save(page: Page) {
  const saved = page.waitForResponse(
    response =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname.endsWith('/api/cases/1')
  )
  await getSaveButton(page).click()
  expect((await saved).ok()).toBe(true)
}

async function getStored(entry: CaseEntry) {
  const row = await Case.query().findById(1)
  return (row as Record<string, unknown> | undefined)?.[entry.name] ?? null
}

async function runCase(page: Page, url: string, entry: CaseEntry) {
  const driver = getDriver(entry.type)
  if (entry.seed !== undefined) {
    await Case.query().patch({ [entry.name]: entry.seed }).findById(1)
  }
  await openCase(page, url, entry)
  if (entry.value !== undefined) {
    await driver.setValue(page, entry, entry.value)
    if (entry.invalid) {
      await getSaveButton(page).click()
      await expect(page.locator('.dito-notification.error')).toBeVisible()
      expect(await getStored(entry)).toEqual(entry.seed ?? null)
      return
    }
    await save(page)
    expect(await getStored(entry)).toEqual(entry.stored)
    await openCase(page, url, entry)
  }
  const shown =
    entry.shown ?? (typeof entry.value === 'string' ? entry.value : undefined)
  if (shown !== undefined) {
    expect(await driver.getValue(page, entry)).toEqual(shown)
  }
}

for (const type of new Set(caseEntries.map(entry => entry.type))) {
  test.describe(type, () => {
    for (const entry of caseEntries.filter(entry => entry.type === type)) {
      test(entry.title, ({ page, url }) => runCase(page, url, entry))
    }
  })
}
