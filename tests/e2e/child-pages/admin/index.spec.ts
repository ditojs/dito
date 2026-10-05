import { test, expect } from '../fixtures.js'
import { Page } from '../models/Page.js'

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
})
