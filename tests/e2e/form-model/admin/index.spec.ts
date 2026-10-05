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

  test('marks forms dirty by their data, not by derived values', async ({
    page,
    url
  }) => {
    // The form model writes `slug`, `titleLength`, `status`, `category` and
    // `topic` into the data after it is loaded, which doesn't make it dirty.
    const article = await Article.query().insert({ title: 'Old' })
    await openArticle(page, url, article)
    await page.getByRole('tab', { name: 'Meta', exact: true }).click()
    await page.getByRole('button', { name: 'SEO' }).click()
    await expect(page.getByLabel('Topic', { exact: true })).toHaveValue(
      'politics'
    )
    await page.getByRole('tab', { name: 'Main', exact: true }).click()
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
})
