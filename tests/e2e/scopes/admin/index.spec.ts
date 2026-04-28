import { test, expect } from '../fixtures.js'
import {
  DitoListView,
  DitoFilterPanel
} from '../../../utils/pages.js'

test.describe('scopes', () => {
  test('default scope shows all widgets', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await expect(
      page.getByRole('button', { name: 'Create', exact: true })
    ).toBeHidden()
    // Default scope: both rows visible.
    await expect(list.list.getRow('Alpha')).toBeVisible()
    await expect(list.list.getRow('Beta')).toBeVisible()
  })

  test('Published scope hides unpublished rows', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.selectScope('Published')
    await expect(list.list.getRow('Alpha')).toBeVisible()
    await expect(list.list.getRow('Beta')).toBeHidden()
  })

  test('Unpublished scope hides published rows', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Widget')
    await list.navigate('/widgets')
    await list.list.selectScope('Unpublished')
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
})
