import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Book } from '../models/Book.js'

// The contexts that schema callbacks receive must be the same wherever they
// are evaluated: in panes, containers, type components and the form model.
// The fields' `if` callbacks record the contexts they see, see `views.ts`.

async function seedBook() {
  return Book.query().insert({
    marker: 'book',
    title: 'Title',
    meta: { marker: 'meta', note: 'Note' },
    tags: [{ marker: 'tag-0', name: 'Tag' }],
    chapters: [{ marker: 'chapter-0', title: 'Chapter' }],
    notes: [{ marker: 'note-0', text: 'Note' }],
    prices: [100]
  })
}

function getRecordedContexts(page: Page) {
  return page.evaluate(() => window.recordedContexts ?? {})
}

async function openItemForm(page: Page, list: string) {
  await page
    .getByRole('region', { name: list, exact: true })
    .locator(':scope > table > tbody > tr')
    .first()
    .getByRole('link', { name: 'Edit' })
    .click()
}

test.describe('component contexts', () => {
  test('are the same for all evaluations of a field', async ({
    page,
    url
  }) => {
    const book = await seedBook()
    await page.goto(`${url}/admin/books/${book.id}`)
    await expect(page.getByLabel('Title', { exact: true })).toBeVisible()
    await expect(page.getByLabel('ISBN', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Website', { exact: true })).toHaveAttribute(
      'id',
      'main/links/website'
    )
    await page.getByRole('tab', { name: 'Details' }).click()
    await expect(page.getByLabel('Edition', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Main' }).click()
    await openItemForm(page, 'Chapters')
    await expect(page).toHaveURL(/\/chapters\/0$/)
    await page.goBack()
    await openItemForm(page, 'Notes')
    await expect(page).toHaveURL(/\/notes\/0$/)

    const book0 = 'rootItem: book'
    expect(await getRecordedContexts(page)).toEqual({
      'title': [`title, item: book, parentItem: null, ${book0}`],
      'subtitle': [`subtitle, item: book, parentItem: null, ${book0}`],
      'edition': [`edition, item: book, parentItem: null, ${book0}`],
      'isbn': [`isbn, item: book, parentItem: null, ${book0}`],
      'website': [`website, item: book, parentItem: null, ${book0}`],
      'meta.note': [`meta/note, item: meta, parentItem: book, ${book0}`],
      'tags.name': [`tags/0/name, item: tag-0, parentItem: book, ${book0}`],
      'chapters.title': [
        `chapters/0/title, item: chapter-0, parentItem: book, ${book0}`
      ],
      'notes.text': [
        `notes/0/text, item: note-0, parentItem: book, ${book0}`
      ],
      // Primitive values are edited with the item's data path, so that
      // validation errors can be mapped to them.
      'prices.price': [
        `prices/0, item: {"price":100}, parentItem: book, ${book0}`
      ]
    })
  })
})
