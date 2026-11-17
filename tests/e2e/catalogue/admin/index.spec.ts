import { test, expect } from '../fixtures.js'
import { DitoListView } from '../../../utils/pages.js'

test.describe('catalogue', () => {
  test('sorts by a column from the first page', async ({ page, url }) => {
    const view = new DitoListView(page, url, 'Books')
    await view.navigate('/books')
    await page.getByRole('button', { name: 'Page 2' }).click()
    await expect(view.list.getRow('Persuasion')).toBeVisible()
    await page.getByRole('button', { name: 'Year' }).click()
    await expect(page).toHaveURL(/order=year(\+|%20)asc/)
    await expect(view.list.rows.first()).toContainText('Don Quixote')
    await expect(
      page.getByRole('button', { name: 'Page 1' })
    ).toHaveAttribute('aria-current', 'page')
  })

  test('expands and collapses all chapters', async ({ page, url }) => {
    const view = new DitoListView(page, url, 'Books')
    await view.navigate('/books')
    await view.list.edit('Emma')
    const summaries = page.getByLabel('Summary')
    await expect(summaries).toHaveCount(0)
    await page.getByRole('button', { name: 'Expand All' }).click()
    await expect(summaries).toHaveCount(3)
    await page.getByRole('button', { name: 'Collapse All' }).click()
    await expect(summaries).toHaveCount(0)
  })
})
