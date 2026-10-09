import { test, expect } from '../fixtures.js'
import { Page } from '../models/Page.js'
import { DitoNestedList } from '../../../utils/pages.js'
import { getConfirmDialog } from '../../../utils/dialogs.js'

test.describe('child pages', () => {
  test(`doesn't mark forms dirty by loading the items of sources`, async ({
    page,
    url
  }) => {
    const parent = await Page.query().insertGraph({
      name: 'Parent',
      order: 0,
      // Numbered differently than the list numbers them, so that loading them
      // changes their order keys.
      childPages: [
        { name: 'First', order: 5 },
        { name: 'Second', order: 7 }
      ]
    })
    await page.goto(`${url}/admin/pages/${parent.id}`)
    const rows = page
      .getByRole('region', { name: 'Child Pages', exact: true })
      .locator(':scope > table > tbody > tr')
    await expect(rows).toHaveCount(2)
    // Leaving a dirty form would ask for confirmation.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page).toHaveURL(/\/pages$/)
    await expect(getConfirmDialog(page)).toHaveCount(0)
  })

  test('stores the order through buttons with resources', async ({
    page,
    url
  }) => {
    await Page.query().insert({ name: 'First', order: 0 })
    await Page.query().insert({ name: 'Second', order: 1 })
    await page.goto(`${url}/admin/page-order`)
    const list = new DitoNestedList(page, 'Page Order')
    await expect(list.rows).toHaveCount(2)
    await list.dragRow(0, 1)
    await expect(list.rows.first()).toContainText('Second')
    await page.getByRole('button', { name: 'Save Order' }).click()
    await expect(page.getByText('The order was saved.')).toBeVisible()
    const pages = await Page.query().orderBy('order')
    expect(pages.map(({ name, order }) => ({ name, order }))).toEqual([
      { name: 'Second', order: 0 },
      { name: 'First', order: 1 }
    ])
  })
})
