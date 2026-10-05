import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Article } from '../models/Article.js'

// Computed values are written into the data by the form model, independently
// of what is rendered: The computed fields of this scenario are in a collapsed
// section of a tab that isn't selected, see `views.ts`.

async function openArticle(page: Page, url: string, article: Article) {
  await page.goto(`${url}/admin/articles/${article.id}`)
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible()
}

// Waits for the delayed options of `category` and `topic`, which `topic` loads
// last, so that the values derived from them are written into the data.
async function waitForDelayedOptions(page: Page) {
  await page.getByRole('tab', { name: 'Meta', exact: true }).click()
  await page.getByRole('button', { name: 'SEO' }).click()
  await expect(page.getByLabel('Topic', { exact: true })).toHaveValue(
    'politics'
  )
  await page.getByRole('tab', { name: 'Main', exact: true }).click()
}

test.describe('form model', () => {
  test('keeps computed values current without rendering them', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    const permalink = page.getByLabel('Permalink', { exact: true })
    await expect(permalink).toHaveValue('/articles/old')
    await page.getByLabel('Title', { exact: true }).fill('Hello World')
    await expect(permalink).toHaveValue('/articles/hello-world')
  })

  test('saves computed values of fields in closed tabs', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await page.getByLabel('Title', { exact: true }).fill('Hello World')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => {
        const stored = await Article.query().findById(article.id)
        return { slug: stored?.slug, titleLength: stored?.titleLength }
      })
      .toEqual({ slug: 'hello-world', titleLength: 11 })
  })

  test('computes values from the options of rendered fields', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Article.query().findById(article.id))?.status)
      .toBe('draft')
  })

  test('selects options through computes without rendering fields', async ({
    page,
    url
  }) => {
    // `topic` depends on the computed `category` through its options, and
    // isn't rendered. Saving right away waits for the delayed options.
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => {
        const stored = await Article.query().findById(article.id)
        return { category: stored?.category, topic: stored?.topic }
      })
      .toEqual({ category: 'news', topic: 'politics' })
  })

  test('reselects unrendered options when dependencies change', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({
      title: 'Old',
      category: 'news',
      topic: 'economy'
    })
    await openArticle(page, url, article)
    const category = page.getByLabel('Category', { exact: true })
    await expect(category).toHaveValue('news')
    await category.selectOption({ label: 'Sports' })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => {
        const stored = await Article.query().findById(article.id)
        return { category: stored?.category, topic: stored?.topic }
      })
      .toEqual({ category: 'sports', topic: 'football' })
  })

  test('handles options from data that was reset', async ({ page, url }) => {
    const article = await Article.query().insert({
      title: 'Old',
      chooser: {
        source: { topics: [{ label: 'Politics', value: 'politics' }] },
        topic: 'politics'
      }
    })
    await openArticle(page, url, article)
    await page.getByRole('button', { name: 'Reset Chooser' }).click()
    await page.getByLabel('Title', { exact: true }).fill('New')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Article.query().findById(article.id))?.title)
      .toBe('New')
  })

  test('computes values before applying their defaults', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({
      title: 'Old',
      customFactor: 10
    })
    await openArticle(page, url, article)
    await expect(page.getByLabel('Pricing', { exact: true })).toHaveValue(
      'factor'
    )
    await expect(page.getByLabel('Custom Factor', { exact: true })).toHaveValue(
      '10'
    )
    await page.getByLabel('Title', { exact: true }).fill('New')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => {
        const stored = await Article.query().findById(article.id)
        return { title: stored?.title, customFactor: stored?.customFactor }
      })
      .toEqual({ title: 'New', customFactor: 10 })
  })

  test('gives the components of list items their own ids', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({
      title: 'Old',
      lines: [{ amount: 1 }, { amount: 2 }]
    })
    await openArticle(page, url, article)
    const amounts = page.getByLabel('Amount', { exact: true })
    await expect(amounts.nth(0)).toHaveAttribute('id', 'main/lines/0/amount')
    await expect(amounts.nth(1)).toHaveAttribute('id', 'main/lines/1/amount')
  })

  test('stops computing values of removed list items', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({
      title: 'Old',
      lines: [{ amount: 1 }, { amount: 2 }]
    })
    await openArticle(page, url, article)
    const doubleAmounts = page.getByLabel('Double Amount', { exact: true })
    await expect(doubleAmounts).toHaveCount(2)
    await expect(doubleAmounts.nth(1)).toHaveValue('4')
    const lines = page.getByRole('region', { name: 'Lines', exact: true })
    page.once('dialog', dialog => dialog.accept())
    await lines
      .locator(':scope > table > tbody > tr')
      .nth(1)
      .getByRole('button', { name: 'Remove' })
      .click()
    await expect(doubleAmounts).toHaveCount(1)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Article.query().findById(article.id))?.lines)
      .toEqual([{ amount: 1 }])
  })

  test('marks forms dirty by their data, not by derived values', async ({
    page,
    url
  }) => {
    // The form model writes `slug`, `titleLength`, `status`, `category` and
    // `topic` into the data after it is loaded, which doesn't make it dirty.
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await waitForDelayedOptions(page)
    const dialogMessages: string[] = []
    page.on('dialog', dialog => {
      dialogMessages.push(dialog.message())
      return dialog.dismiss()
    })
    const title = page.getByLabel('Title', { exact: true })
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
    // Leaving a dirty form asks for confirmation.
    await title.fill('New')
    await cancel.click()
    expect(dialogMessages).toEqual([
      expect.stringContaining('You have unsaved changes')
    ])
    // Changing the value back makes the form clean again.
    await title.fill('Old')
    await cancel.click()
    await expect(page).toHaveURL(/\/articles$/)
    expect(dialogMessages).toHaveLength(1)
  })
  test('marks forms dirty by excluded values that `process()` stores', async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({ title: 'Old', tags: ['a'] })
    await openArticle(page, url, article)
    const dialogMessages: string[] = []
    page.on('dialog', dialog => {
      dialogMessages.push(dialog.message())
      return dialog.dismiss()
    })
    const tags = page.getByLabel('Tags', { exact: true })
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
    await expect(tags).toHaveValue('a')
    await tags.fill('a,b')
    await cancel.click()
    expect(dialogMessages).toEqual([
      expect.stringContaining('You have unsaved changes')
    ])
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Article.query().findById(article.id))?.tags)
      .toEqual(['a', 'b'])
  })
  test("doesn't mark forms dirty by clean changes", async ({
    page,
    url
  }) => {
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await waitForDelayedOptions(page)
    const dialogMessages: string[] = []
    page.on('dialog', dialog => {
      dialogMessages.push(dialog.message())
      return dialog.dismiss()
    })
    const title = page.getByLabel('Title', { exact: true })
    await page.getByRole('button', { name: 'Apply Saved Title' }).click()
    await expect(title).toHaveValue('Saved')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page).toHaveURL(/\/articles$/)
    expect(dialogMessages).toEqual([])
  })
  test('returns the reactive data from `setData()`', async ({ page, url }) => {
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await page.getByRole('button', { name: 'Replace Data' }).click()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Replaced and Modified'
    )
  })
  test('computes values of new items from their defaults', async ({
    page,
    url
  }) => {
    await page.goto(`${url}/admin/articles/create`)
    await expect(page.getByLabel('Keyword', { exact: true })).toHaveCount(1)
    await page.getByLabel('Title', { exact: true }).fill('New')
    await page.getByLabel('Keyword', { exact: true }).fill('News')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect
      .poll(async () => (await Article.query().findOne({ title: 'New' }))?.keywords)
      .toEqual(['News'])
  })
  test("doesn't evaluate components that `if` hides", async ({ page, url }) => {
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await page.getByLabel('Preview Key', { exact: true }).fill('key')
    await page.getByLabel('Title', { exact: true }).fill('New')
    await page.getByRole('button', { name: 'Reset Preview' }).click()
    await page.getByLabel('Title', { exact: true }).fill('Newer')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => (await Article.query().findById(article.id))?.title)
      .toBe('Newer')
  })

  test('shows tabs by their `if`', async ({ page, url }) => {
    const article = await Article.query().insert({ title: 'Draft' })
    await openArticle(page, url, article)
    const stats = page.getByRole('tab', { name: 'Stats', exact: true })
    await expect(stats).toHaveCount(0)
    await page.getByLabel('Title', { exact: true }).fill('Published')
    await stats.click()
    await expect(page.getByLabel('Views', { exact: true })).toBeVisible()
  })

  test('counts edits made while options load', async ({ page, url }) => {
    // The form model derives `category` and `topic` from delayed options,
    // which don't count, while the edit of `title` right away does.
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    const dialogMessages: string[] = []
    page.on('dialog', dialog => {
      dialogMessages.push(dialog.message())
      return dialog.dismiss()
    })
    await page.getByLabel('Title', { exact: true }).fill('New')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(dialogMessages).toEqual([
      expect.stringContaining('You have unsaved changes')
    ])
  })

  test('keeps the ids of items of lists without forms', async ({
    page,
    url
  }) => {
    // The dirty check processes the data like the clipboard does, which
    // removes ids, but only from its own copy of the data.
    const article = await Article.query().insert({
      title: 'Old',
      references: [{ id: 1, title: 'Reference' }]
    })
    await openArticle(page, url, article)
    await page.getByLabel('Title', { exact: true }).fill('New')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(async () => {
        const stored = await Article.query().findById(article.id)
        return { title: stored?.title, references: stored?.references }
      })
      .toEqual({ title: 'New', references: [{ id: 1, title: 'Reference' }] })
  })
})
