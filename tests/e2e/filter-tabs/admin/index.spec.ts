import { test, expect } from '../fixtures.js'
import {
  DitoListView,
  DitoFilterPanel
} from '../../../utils/pages.js'

test.describe('filter tabs', () => {
  test('the default tab shows all widgets', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await expect(
      page.getByRole('button', { name: 'Create', exact: true })
    ).toBeHidden()
    // The default tab: both rows visible.
    await expect(list.list.getRow('Alpha')).toBeVisible()
    await expect(list.list.getRow('Beta')).toBeVisible()
  })

  test('the Published tab hides unpublished rows', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.selectFilterTab('Published')
    await expect(list.list.getRow('Alpha')).toBeVisible()
    await expect(list.list.getRow('Beta')).toBeHidden()
  })

  test('the Unpublished tab hides published rows', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.selectFilterTab('Unpublished')
    await expect(list.list.getRow('Beta')).toBeVisible()
    await expect(list.list.getRow('Alpha')).toBeHidden()
  })

  test('search filter narrows visible rows', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    const filters = new DitoFilterPanel(page)
    await list.navigate('/widgets')
    await expect(list.list.getRow('Alpha')).toBeVisible()
    await filters.fillFilter('Search', 'Alpha')
    await expect(list.list.getRow('Alpha')).toBeVisible()
    await expect(list.list.getRow('Beta')).toBeHidden()
  })

  test('the filters panel keeps the tab', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    const filters = new DitoFilterPanel(page)
    await list.navigate('/widgets')
    await list.list.selectFilterTab('Unpublished')
    await expect(list.list.getRow('Alpha')).toBeHidden()
    await filters.fillFilter('Search', 'a')
    await expect(list.list.getRow('Beta')).toBeVisible()
    await expect(list.list.getRow('Alpha')).toBeHidden()
  })
})
