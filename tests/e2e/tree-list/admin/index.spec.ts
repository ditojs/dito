import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Family, type ShopSet } from '../models/Family.js'
import { DitoForm, dragHandle } from '../../../utils/pages.js'

async function openFamily(page: Page, url: string, shopSets: ShopSet[]) {
  const family = await Family.query().insert({ name: 'Family', shopSets })
  await page.goto(`${url}/admin/families/${family.id}`)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Family')
  return family
}

function getTreeHeader(page: Page, label: string) {
  return page
    .locator('.dito-tree-header')
    .filter({ has: page.locator('.dito-tree-label', { hasText: label }) })
}

function getTreeLabels(page: Page) {
  return page.locator('.dito-tree-header:visible .dito-tree-label')
}

// The buttons of tree items only show while hovering them.
async function editTreeItem(page: Page, label: string) {
  const header = getTreeHeader(page, label)
  await header.hover()
  await header.getByRole('button', { name: 'Edit' }).click()
}

async function getStoredShopSets(family: Family) {
  return (await Family.query().findById(family.id))?.shopSets
}

test.describe('tree list', () => {
  test('shows items and opens their children', async ({ page, url }) => {
    await openFamily(page, url, [
      { name: 'Text', order: 0, cuts: [{ name: 'Book', order: 0 }] }
    ])
    await expect(getTreeLabels(page)).toHaveText(['Text'])
    await page.getByRole('button', { name: 'Text' }).click()
    await expect(getTreeLabels(page)).toHaveText(['Text', 'Book'])
  })

  test('stores items edited in their forms', async ({ page, url }) => {
    const family = await openFamily(page, url, [
      { name: 'Text', order: 0, cuts: [] }
    ])
    await editTreeItem(page, 'Text')
    await page.getByLabel('Shop Set Name', { exact: true }).fill('Display')
    await expect(getTreeHeader(page, 'Display')).toBeVisible()
    await new DitoForm(page).save()
    expect(await getStoredShopSets(family)).toEqual([
      { name: 'Display', order: 0, cuts: [] }
    ])
  })

  test('stores children edited in their forms', async ({ page, url }) => {
    const family = await openFamily(page, url, [
      {
        name: 'Text',
        order: 0,
        cuts: [
          { name: 'Book', order: 0 },
          { name: 'Bold', order: 1 }
        ]
      }
    ])
    await page.getByRole('button', { name: 'Text' }).click()
    await editTreeItem(page, 'Bold')
    await page.getByLabel('Cut Name', { exact: true }).fill('Black')
    await new DitoForm(page).save()
    expect(await getStoredShopSets(family)).toEqual([
      {
        name: 'Text',
        order: 0,
        cuts: [
          { name: 'Book', order: 0 },
          { name: 'Black', order: 1 }
        ]
      }
    ])
  })

  test('stores the order of reordered items', async ({ page, url }) => {
    const family = await openFamily(page, url, [
      { name: 'Text', order: 0, cuts: [] },
      { name: 'Display', order: 1, cuts: [] }
    ])
    const getHandle = (label: string) =>
      getTreeHeader(page, label).locator('.dito-button[title="Drag"]')
    await getTreeHeader(page, 'Text').hover()
    await dragHandle(page, getHandle('Text'), getHandle('Display'))
    await expect(getTreeLabels(page)).toHaveText(['Display', 'Text'])
    await new DitoForm(page).save()
    expect(await getStoredShopSets(family)).toEqual([
      { name: 'Display', order: 0, cuts: [] },
      { name: 'Text', order: 1, cuts: [] }
    ])
  })
})
