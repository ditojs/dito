import type { Page } from '@playwright/test'
import { test, expect } from './fixtures.js'
import { Case } from './models/Case.js'
import type { CaseEntry } from './cases/define.js'
import { getDriver } from '../../utils/drivers/index.js'
import { getContainer } from '../../utils/drivers/markup.js'

async function openCase(page: Page, url: string, entry: CaseEntry) {
  await page.goto(`${url}/admin/${entry.path}`)
  if (entry.state === 'hidden') {
    await expect(getSaveButton(page)).toBeVisible()
  } else {
    await expect(getDriver(entry.type).getElement(page, entry)).toBeVisible()
  }
}

async function setValue(page: Page, entry: CaseEntry) {
  const { value } = entry
  if ((value as { clear?: boolean }).clear) {
    // The clear button only shows while hovering the component.
    const container = getContainer(page, entry)
    await container.hover()
    await container.getByRole('button', { name: 'Clear' }).click()
  } else {
    await getDriver(entry.type).setValue(page, entry, value)
  }
}

/**
 * Tries to change the value of an unchangeable component and to save it,
 * which must leave the stored value untouched.
 */
async function expectUnchangeable(page: Page, entry: CaseEntry) {
  const element = getDriver(entry.type).getElement(page, entry)
  if (await element.isEditable().catch(() => true)) {
    // Custom controls don't report their state, so try to change them, but
    // don't wait long for the blocked ones.
    const stored = await getStored(entry)
    page.setDefaultTimeout(1000)
    try {
      await setValue(page, entry)
    } catch {
      // Expected for blocked controls.
    }
    page.setDefaultTimeout(test.info().project.use.actionTimeout ?? 0)
    await getSaveButton(page).click()
    await page.waitForLoadState('networkidle')
    expect(await getStored(entry)).toEqual(stored)
  }
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
  const { type } = entry.property
  if (type === 'date' || type === 'datetime') {
    // Read dates as database text, unaffected by the driver's parsing in the
    // server's timezone: `2026-05-14`, or ISO for datetimes.
    const { rows } = await Case.knex().raw(
      'select ??::text as value from ?? where id = 1',
      [entry.name, Case.tableName]
    )
    const { value } = rows[0]
    return value && type === 'datetime'
      ? new Date(value).toISOString()
      : value
  }
  const row = await Case.query().findById(1)
  return (row as Record<string, unknown> | undefined)?.[entry.name] ?? null
}

export async function runCase(page: Page, url: string, entry: CaseEntry) {
  const driver = getDriver(entry.type)
  if (entry.seed !== undefined) {
    await Case.query().patch({ [entry.name]: entry.seed }).findById(1)
  }
  await openCase(page, url, entry)
  if (entry.state === 'hidden') {
    await expect(getContainer(page, entry)).toBeHidden()
    return
  }
  if (entry.state === 'unchangeable') {
    return expectUnchangeable(page, entry)
  }
  if (entry.invalid && entry.value === undefined) {
    await getSaveButton(page).click()
    await expect(page.locator('.dito-notification.error')).toBeVisible()
    return
  }
  if (entry.value !== undefined) {
    await setValue(page, entry)
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

