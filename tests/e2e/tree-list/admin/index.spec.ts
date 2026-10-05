import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Library, type Shelf } from '../models/Library.js'
import { DitoForm, dragHandle } from '../../../utils/pages.js'

async function openLibrary(page: Page, url: string, shelves: Shelf[]) {
  const library = await Library.query().insert({ name: 'Library', shelves })
  await page.goto(`${url}/admin/libraries/${library.id}`)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Library')
  return library
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

async function getStoredShelfs(library: Library) {
  return (await Library.query().findById(library.id))?.shelves
}

test.describe('tree list', () => {
  test('shows items and opens their children', async ({ page, url }) => {
    await openLibrary(page, url, [
      { name: 'Fiction', order: 0, books: [{ name: 'Dune', order: 0 }] }
    ])
    await expect(getTreeLabels(page)).toHaveText(['Fiction'])
    await page.getByRole('button', { name: 'Fiction' }).click()
    await expect(getTreeLabels(page)).toHaveText(['Fiction', 'Dune'])
  })

  test('stores items edited in their forms', async ({ page, url }) => {
    const library = await openLibrary(page, url, [
      { name: 'Fiction', order: 0, books: [] }
    ])
    await editTreeItem(page, 'Fiction')
    await page.getByLabel('Shelf Name', { exact: true }).fill('Poetry')
    await expect(getTreeHeader(page, 'Poetry')).toBeVisible()
    await new DitoForm(page).save()
    expect(await getStoredShelfs(library)).toEqual([
      { name: 'Poetry', order: 0, books: [] }
    ])
  })

  test('stores children edited in their forms', async ({ page, url }) => {
    const library = await openLibrary(page, url, [
      {
        name: 'Fiction',
        order: 0,
        books: [
          { name: 'Dune', order: 0 },
          { name: 'Emma', order: 1 }
        ]
      }
    ])
    await page.getByRole('button', { name: 'Fiction' }).click()
    await editTreeItem(page, 'Emma')
    await page.getByLabel('Book Title', { exact: true }).fill('Ulysses')
    await new DitoForm(page).save()
    expect(await getStoredShelfs(library)).toEqual([
      {
        name: 'Fiction',
        order: 0,
        books: [
          { name: 'Dune', order: 0 },
          { name: 'Ulysses', order: 1 }
        ]
      }
    ])
  })

  test('stores the order of reordered items', async ({ page, url }) => {
    const library = await openLibrary(page, url, [
      { name: 'Fiction', order: 0, books: [] },
      { name: 'Poetry', order: 1, books: [] }
    ])
    const getHandle = (label: string) =>
      getTreeHeader(page, label).locator('.dito-button[title="Drag"]')
    await getTreeHeader(page, 'Fiction').hover()
    await dragHandle(page, getHandle('Fiction'), getHandle('Poetry'))
    await expect(getTreeLabels(page)).toHaveText(['Poetry', 'Fiction'])
    await new DitoForm(page).save()
    expect(await getStoredShelfs(library)).toEqual([
      { name: 'Poetry', order: 0, books: [] },
      { name: 'Fiction', order: 1, books: [] }
    ])
  })
})
