import { test, expect } from '../fixtures.js'
import { getCase } from '../cases/index.js'
import { object } from '../../../utils/drivers/structure.js'

// Object routing beyond value round-trips, using the cases' views.

test.describe('object', () => {
  test('redirects the form of a missing object to its create form', async ({
    page,
    url
  }) => {
    const entry = getCase('object', 'stores an object created in its form')
    await page.goto(`${url}/admin/${entry.path}`)
    await object
      .getElement(page, entry)
      .getByRole('button', { name: /Create|Add/ })
      .click()
    await expect(page).toHaveURL(/\/create$/)
    // Open the object's own form, while there is no object to edit yet.
    const formUrl = page.url().replace(/\/create$/, '')
    await page.goto(formUrl)
    await expect(page).toHaveURL(`${formUrl}/create`)
    await expect(
      page.locator('.dito-form').last().getByLabel('Name', { exact: true })
    ).toBeVisible()
  })
})
