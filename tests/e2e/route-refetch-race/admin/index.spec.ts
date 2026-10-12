import { test, expect } from '../fixtures.js'
import { Widget } from '../models/Widget.js'
import {
  DitoListView,
  DitoForm,
  DitoNestedList
} from '../../../utils/pages.js'

test.describe('route-refetch-race', () => {
  test('dirty form keeps its edits when its list reloads after a save', async ({
    page,
    url
  }) => {
    const widget = await Widget.query().insertGraph({
      name: 'before',
      items: [{ label: 'item-one' }]
    })

    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)
    const items = new DitoNestedList(page, 'Items')

    await list.navigate('/widgets')
    await list.list.edit('before')
    await items.edit(0)
    await form.fill('Label', 'item-two')

    // Hold the reload of the items that saving the item triggers, until the
    // widget is edited:
    let releaseReload!: () => void
    const isEdited = new Promise<void>(resolve => {
      releaseReload = resolve
    })
    let isReloadHeld = false
    await page.route(/\/api\/widgets\/\d+\/items(\?|$)/, async (route, req) => {
      if (req.method() === 'GET' && !isReloadHeld) {
        isReloadHeld = true
        await isEdited
      }
      await route.continue()
    })

    // The item form closes once saved, back to the widget form:
    await form.save()
    await expect(form.getField('Name')).toBeVisible()
    await form.fill('Name', 'after')
    const reloaded = page.waitForResponse(
      response => (
        /\/api\/widgets\/\d+\/items(\?|$)/.test(response.url()) &&
        response.request().method() === 'GET'
      )
    )
    releaseReload()
    await reloaded
    await expect(form.getField('Name')).toHaveValue('after')

    await form.save()
    const saved = await Widget.query()
      .findById(widget.$id() as number)
      .withGraphFetched('items')
    expect(saved?.name).toBe('after')
    expect(saved?.items?.map(item => item.label)).toEqual(['item-two'])
  })
})
