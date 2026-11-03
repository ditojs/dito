import { wrap } from '@mikro-orm/core'
import { test, expect, db } from '../fixtures.js'
import { Draft } from '../models/Draft.js'
import { DitoForm, DitoListView } from '../../../utils/pages.js'

test.describe('defaults', () => {
  test('stores the defaults of new items', async ({ page, url }) => {
    const list = new DitoListView(page, url, 'Draft')
    await list.navigate('/drafts')
    await list.list.create()
    await page.getByLabel('Name', { exact: true }).fill('New')
    await new DitoForm(page).create()
    await expect
      .poll(() => db.findOne(Draft, { name: 'New' }))
      .toBeTruthy()
    const draft = await db.findOne(Draft, { name: 'New' })
    const { id: _id, ...entry } = wrap(draft!).toObject()
    expect(entry).toEqual({
      name: 'New',
      note: null,
      title: 'Untitled',
      count: 3,
      archived: null,
      published: false,
      size: 'm',
      features: [],
      tags: ['x'],
      priority: 'low',
      code: 'code-default',
      rows: [],
      settings: { mode: 'auto' }
    })
  })
})
