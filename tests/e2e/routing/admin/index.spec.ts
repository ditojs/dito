import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Book } from '../models/Book.js'
import { DitoNestedList } from '../../../utils/pages.js'

const entries = [{ title: 'First' }, { title: 'Second' }]

async function insertBook(book: Partial<Book> = {}) {
  const { id } = await Book.query().insert({ title: 'Emma', ...book })
  return id
}

async function openBook(
  page: Page,
  url: string,
  book: Partial<Book>,
  view = 'books'
) {
  const id = await insertBook(book)
  await page.goto(`${url}/admin/${view}/${id}`)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Emma')
  return id
}

/** The innermost form, e.g. a nested form. */
function getForm(page: Page) {
  return page.locator('.dito-form').last()
}

/** Opens the form of the second entry of the list and checks its item. */
async function editSecondEntry(page: Page, listLabel: string) {
  await new DitoNestedList(page, listLabel).edit(1)
  await expect(
    getForm(page).getByLabel('Entry Title', { exact: true })
  ).toHaveValue('Second')
}

test.describe('routes of nested forms', () => {
  test('opens the forms of list items', async ({ page, url }) => {
    const id = await openBook(page, url, { chapters: entries })
    await editSecondEntry(page, 'Chapters')
    await expect(page).toHaveURL(new RegExp(`/books/${id}/chapters/1$`))
  })

  test('opens the forms of list items when reloaded on them', async ({
    page,
    url
  }) => {
    const id = await insertBook({ chapters: entries })
    await page.goto(`${url}/admin/books/${id}/chapters/1`)
    await expect(
      getForm(page).getByLabel('Entry Title', { exact: true })
    ).toHaveValue('Second')
  })

  test('shows the tab of the list after closing reloaded forms', async ({
    page,
    url
  }) => {
    const id = await insertBook({ chapters: entries })
    await page.goto(`${url}/admin/tabbed-books/${id}/content/chapters/1`)
    await expect(
      getForm(page).getByLabel('Entry Title', { exact: true })
    ).toHaveValue('Second')
    await getForm(page)
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/tabbed-books/${id}/content$`))
    await expect(
      page.getByRole('tab', { name: 'Content', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
  })

  test('opens the forms of lists with their own path', async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, { appendices: entries })
    await editSecondEntry(page, 'Appendices')
    await expect(page).toHaveURL(new RegExp(`/books/${id}/extras/1$`))
  })

  test('opens the forms of lists in nested sections', async ({
    page,
    url
  }) => {
    await openBook(page, url, { contents: { notes: entries } })
    await editSecondEntry(page, 'Notes')
  })

  test('opens the forms of lists in sections', async ({ page, url }) => {
    await openBook(page, url, { quotes: entries })
    await editSecondEntry(page, 'Quotes')
  })

  test('opens the forms of lists in inlined objects', async ({
    page,
    url
  }) => {
    await openBook(page, url, { meta: { sources: entries } })
    await editSecondEntry(page, 'Sources')
  })

  test(`opens the forms of lists whose names don't survive their paths`, async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, { sourceURLs: entries })
    await editSecondEntry(page, 'Source URLs')
    await expect(page).toHaveURL(new RegExp(`/books/${id}/source-urls/1$`))
  })

  test('opens the forms of lists in forms shared by views', async ({
    page,
    url
  }) => {
    await openBook(page, url, { chapters: entries }, 'drafts')
    await editSecondEntry(page, 'Chapters')
  })
})

test.describe('routes of linked views', () => {
  test('edits items in the linked view', async ({ page, url }) => {
    const id = await insertBook()
    await page.goto(`${url}/admin/featured`)
    await page
      .getByRole('region', { name: 'Featured', exact: true })
      .getByRole('link', { name: 'Edit' })
      .click()
    await expect(page).toHaveURL(new RegExp(`/shelf/shelf-books/${id}$`))
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Emma')
  })

  test('creates items in the linked view', async ({ page, url }) => {
    await page.goto(`${url}/admin/featured`)
    await page
      .getByRole('region', { name: 'Featured', exact: true })
      .getByRole('button', { name: 'Create Book' })
      .click()
    await expect(page).toHaveURL(/\/shelf\/shelf-books\/create$/)
  })
})
