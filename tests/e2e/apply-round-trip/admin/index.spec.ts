import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Book } from '../models/Book.js'
import { DitoForm, DitoNestedList } from '../../../utils/pages.js'

async function openBook(page: Page, url: string, book: Partial<Book>) {
  const { id } = await Book.query().insert({ title: 'Emma', ...book })
  await page.goto(`${url}/admin/books/${id}`)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Emma')
  return id
}

/** The innermost form, e.g. a nested form. */
function getForm(page: Page) {
  return page.locator('.dito-form').last()
}

function getChapters(page: Page) {
  return new DitoNestedList(page, 'Chapters')
}

async function editChapterTitle(page: Page, title: string) {
  await getChapters(page).edit(0)
  await getForm(page).getByLabel('Chapter Title', { exact: true }).fill(title)
}

async function apply(page: Page, id: number) {
  await getForm(page)
    .getByRole('button', { name: 'Apply', exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/books/${id}$`))
}

async function getStoredBook(id: number) {
  return Book.query().findById(id)
}

// Applying a nested form merges its draft into the item in the parent's data,
// which is processed for the server only once the parent is saved.
test.describe('applying nested forms', () => {
  test(`keeps the values of applied items that their forms don't edit`, async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, {
      chapters: [{ title: 'Prologue', wordCount: 1200 }]
    })
    await editChapterTitle(page, 'Opening')
    await apply(page, id)
    await expect(getChapters(page).rows.first()).toContainText('Opening')
    await expect(getChapters(page).rows.first()).toContainText('1200')
  })

  // The payload only holds the values that the components of the schema
  // declare, so items keep the others only with hidden components:
  test('stores the values of items that their forms declare', async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, {
      chapters: [{ title: 'Prologue', wordCount: 1200, pageCount: 4 }]
    })
    await page.getByLabel('Title', { exact: true }).fill('Persuasion')
    await new DitoForm(page).save()
    const [chapter] = (await getStoredBook(id))?.chapters ?? []
    expect(chapter).toMatchObject({ title: 'Prologue', pageCount: 4 })
    expect(chapter).not.toHaveProperty('wordCount')
  })

  test('keeps the excluded values of applied items', async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, {
      chapters: [{ title: 'Prologue' }]
    })
    await getChapters(page).edit(0)
    await getForm(page).getByLabel('Note', { exact: true }).fill('Draft')
    await apply(page, id)
    await getChapters(page).edit(0)
    await expect(
      getForm(page).getByLabel('Note', { exact: true })
    ).toHaveValue(
      'Draft'
    )
  })

  test('keeps the data of related objects in applied items', async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, {
      chapters: [{ title: 'Prologue', author: { id: 1, name: 'Jane' } }]
    })
    await expect(getChapters(page).rows.first()).toContainText('Jane')
    await editChapterTitle(page, 'Opening')
    await apply(page, id)
    await expect(getChapters(page).rows.first()).toContainText('Jane')
  })

  test('processes the values of applied items once', async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, {
      chapters: [{ title: 'Prologue' }]
    })
    await getChapters(page).edit(0)
    await getForm(page).getByLabel('Code', { exact: true }).fill('1')
    await apply(page, id)
    await new DitoForm(page).save()
    expect((await getStoredBook(id))?.chapters).toMatchObject([
      { title: 'Prologue', code: 'ch-1' }
    ])
  })

  test('keeps the children of tree items when applying their forms', async ({
    page,
    url
  }) => {
    const id = await openBook(page, url, {
      volumes: [{ title: 'Early', parts: [{ title: 'Childhood' }] }]
    })
    const header = page
      .locator('.dito-tree-header')
      .filter({ has: page.locator('.dito-tree-label', { hasText: 'Early' }) })
    await header.hover()
    await header.getByRole('link', { name: 'Edit' }).click()
    await getForm(page)
      .getByLabel('Volume Title', { exact: true })
      .fill('Youth')
    await apply(page, id)
    await new DitoForm(page).save()
    expect((await getStoredBook(id))?.volumes).toEqual([
      { title: 'Youth', parts: [{ title: 'Childhood' }] }
    ])
  })
})
