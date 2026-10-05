import { test, expect } from '../fixtures.js'
import { Page } from '../models/Page.js'
import { DitoNestedList } from '../../../utils/pages.js'

test.describe('child pages', () => {
  test("doesn't mark forms dirty by loading the items of sources", async ({
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
    const dialogMessages: string[] = []
    page.on('dialog', dialog => {
      dialogMessages.push(dialog.message())
      return dialog.dismiss()
    })
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page).toHaveURL(/\/pages$/)
    expect(dialogMessages).toEqual([])
  })

  test('stores the order through buttons with resources', async ({
    page,
    url
  }) => {
    await Page.query().insert({ name: 'First', order: 0 })
    await Page.query().insert({ name: 'Second', order: 1 })
    await page.goto(`${url}/admin/page-sequence`)
    const list = new DitoNestedList(page, 'Page Sequence')
    await expect(list.rows).toHaveCount(2)
    await list.dragRow(0, 1)
    await expect(list.rows.first()).toContainText('Second')
    await page.getByRole('button', { name: 'Store Sequence' }).click()
    await expect(page.getByText('The sequence was stored.')).toBeVisible()
    const pages = await Page.query().orderBy('order')
    expect(pages.map(({ name, order }) => ({ name, order }))).toEqual([
      { name: 'Second', order: 0 },
      { name: 'First', order: 1 }
    ])
  })
})
