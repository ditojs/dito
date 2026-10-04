import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Book } from '../models/Book.js'

// Server validation errors for nested data must be displayed on the field
// that holds the invalid value, wherever it is: in another tab, a collapsed
// section, a list row, or a nested form that needs to be opened first.

async function seedBook(data: Partial<Book>) {
  // Skip validation to store data that the server will reject when saved.
  // Validation also applies the defaults, so provide them here.
  const book = await Book.fromJson(
    {
      title: 'Book',
      edition: 'First',
      meta: {},
      tags: [],
      chapters: [],
      ...data
    },
    { skipValidation: true }
  )
  return Book.query().insert(book)
}

async function openBook(page: Page, url: string, book: Book) {
  await page.goto(`${url}/admin/books/${book.id}`)
  await expect(getForm(page).getByLabel('Title', { exact: true })).toBeVisible()
}

/** Saves and expects the server to reject the data. */
async function saveInvalid(page: Page) {
  const response = page.waitForResponse(
    response => response.request().method() === 'PATCH'
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await response).status()).toBe(400)
}

/** The innermost form, e.g. a nested form opened to display an error. */
function getForm(page: Page) {
  return page.locator('.dito-form').last()
}

function clickFormButton(page: Page, name: string) {
  return getForm(page).getByRole('button', { name, exact: true }).click()
}

/**
 * The errors of the field with the given label. They're only present while
 * the field has errors, and are displayed through a tooltip.
 */
function getErrors(scope: Locator, label: string) {
  return scope
    .locator('.dito-container')
    .filter({ has: scope.page().getByLabel(label, { exact: true }) })
    .last()
    .locator('.dito-errors')
}

function getRows(scope: Locator, label: string) {
  return scope
    .getByRole('region', { name: label, exact: true })
    .locator(':scope > table > tbody > tr')
}

const message = /must match pattern/

test.describe('nested validation', () => {
  test('shows server errors on fields', async ({ page, url }) => {
    const book = await seedBook({ title: 'lower' })
    await openBook(page, url, book)
    await saveInvalid(page)
    await expect(getErrors(getForm(page), 'Title')).toContainText(message)
  })

  test('clears server errors on edit and saves corrected data', async ({
    page,
    url
  }) => {
    const book = await seedBook({ title: 'lower' })
    await openBook(page, url, book)
    await saveInvalid(page)
    const form = getForm(page)
    await expect(getErrors(form, 'Title')).toContainText(message)
    await form.getByLabel('Title', { exact: true }).fill('Upper')
    await expect(getErrors(form, 'Title')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Book.query().findById(book.id))?.title)
      .toBe('Upper')
  })

  test('shows server errors on fields in other tabs', async ({ page, url }) => {
    const book = await seedBook({ subtitle: 'lower' })
    await openBook(page, url, book)
    await saveInvalid(page)
    await expect(getErrors(getForm(page), 'Subtitle')).toContainText(message)
  })

  // FIXME: Collapsed content isn't rendered, so the error can't be matched to
  // its field: the section stays collapsed and the error only shows in a
  // notification. Schema-level validation will match errors without needing
  // rendered components.
  test.fail('shows server errors on fields in collapsed sections', async ({
    page,
    url
  }) => {
    const book = await seedBook({ meta: { note: 'lower' } })
    await openBook(page, url, book)
    await saveInvalid(page)
    await expect(getErrors(getForm(page), 'Note')).toContainText(message)
  })

  test('shows server errors on fields of list rows', async ({ page, url }) => {
    const book = await seedBook({
      tags: [{ name: 'Valid' }, { name: 'lower' }]
    })
    await openBook(page, url, book)
    await saveInvalid(page)
    const rows = getRows(getForm(page), 'Tags')
    await expect(getErrors(rows.nth(1), 'Name')).toContainText(message)
    await expect(getErrors(rows.nth(0), 'Name')).toHaveCount(0)
  })

  test('shows server errors on fields of items in nested forms', async ({
    page,
    url
  }) => {
    const book = await seedBook({
      chapters: [{ title: 'Valid', summary: 'Text' },
        { title: 'lower', summary: 'Text' }
      ]
    })
    await openBook(page, url, book)
    await saveInvalid(page)
    // The nested form of the invalid item opens to display the error.
    await expect(page).toHaveURL(/\/chapters\/1$/)
    await expect(getErrors(getForm(page), 'Title')).toContainText(message)
  })

  test('shows server errors on fields of lists in nested forms', async ({
    page,
    url
  }) => {
    const book = await seedBook({
      chapters: [
        {
          title: 'Valid',
          summary: 'Text',
          sections: [{ title: 'Valid' }, { title: 'lower' }]
        }
      ]
    })
    await openBook(page, url, book)
    await saveInvalid(page)
    await expect(page).toHaveURL(/\/chapters\/0$/)
    const rows = getRows(getForm(page), 'Sections')
    await expect(getErrors(rows.nth(1), 'Title')).toContainText(message)
  })

  test('shows server errors on fields of added items', async ({
    page,
    url
  }) => {
    const book = await seedBook({
      chapters: [{ title: 'Valid', summary: 'Text' }]
    })
    await openBook(page, url, book)
    // Add a chapter that isn't stored yet, and has no id.
    const chapters = getForm(page).getByRole('region', {
      name: 'Chapters',
      exact: true
    })
    await chapters
      .getByRole('button', { name: /^(Create|Add) Chapter$/ })
      .click()
    await getForm(page).getByLabel('Title', { exact: true }).fill('lower')
    await getForm(page).getByLabel('Summary', { exact: true }).fill('Text')
    await clickFormButton(page, 'Add')
    await expect(page).toHaveURL(new RegExp(`/books/${book.id}$`))
    await saveInvalid(page)
    await expect(page).toHaveURL(/\/chapters\/1$/)
    await expect(getErrors(getForm(page), 'Title')).toContainText(message)
  })

  // FIXME: Validation only runs in rendered components, so it misses fields in
  // nested forms that aren't open.
  test.fail('validates fields of items in nested forms', async ({
    page,
    url
  }) => {
    const book = await seedBook({ chapters: [{ title: 'Valid' }] })
    await openBook(page, url, book)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/chapters\/0$/)
    await expect(getErrors(getForm(page), 'Summary')).toContainText(
      /required/
    )
  })

  test('validates fields in other tabs', async ({ page, url }) => {
    const book = await seedBook({ edition: null })
    await openBook(page, url, book)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(getErrors(getForm(page), 'Edition')).toContainText(/required/)
  })

  // FIXME: Changes are applied to the parent's data, but their dirty state
  // stays with the closed nested form.
  test.fail('marks forms dirty when applying nested forms', async ({
    page,
    url
  }) => {
    const book = await seedBook({
      chapters: [{ title: 'Valid', summary: 'Text' }]
    })
    await openBook(page, url, book)
    await getRows(getForm(page), 'Chapters')
      .first()
      .getByRole('link', { name: 'Edit' })
      .click()
    await getForm(page).getByLabel('Title', { exact: true }).fill('Changed')
    await clickFormButton(page, 'Apply')
    await expect(page).toHaveURL(new RegExp(`/books/${book.id}$`))
    // Leaving a dirty form asks for confirmation.
    const dialog = page.waitForEvent('dialog', { timeout: 2000 })
    await clickFormButton(page, 'Cancel')
    await (await dialog).dismiss()
  })

  // FIXME: Requires `componentPath`, see the form model roadmap: two lists in
  // two tabs edit the same data with different forms, and errors go to the
  // one whose form can display the error's data path.
  test.fixme('shows server errors in the view that can display them', () => {})
})
