import { test, expect } from '../fixtures.js'
import { getCase } from '../cases/index.js'
import { multiselect } from '../../../utils/drivers/multiselect.js'

// Multiselect search behavior beyond value round-trips, using the cases'
// views.

test.describe('multiselect search', () => {
  test('filters options while typing with searchable', async ({
    page,
    url
  }) => {
    const entry = getCase(
      'multiselect',
      'finds options by search with searchable'
    )
    await page.goto(`${url}/admin/${entry.path}`)
    const element = multiselect.getElement(page, entry)
    await element.click()
    await element.locator('input').fill('lar')
    await expect(page.getByRole('option', { name: 'Large' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Small' })).toBeHidden()
    await expect(page.getByRole('option', { name: 'Medium' })).toBeHidden()
  })

  test('calls a debounced search filter once while typing', async ({
    page,
    url
  }) => {
    const entry = getCase(
      'multiselect',
      'finds options with a debounced search filter'
    )
    await page.goto(`${url}/admin/${entry.path}`)
    const element = multiselect.getElement(page, entry)
    await element.click()
    await element.locator('input').pressSequentially('ap', { delay: 20 })
    await expect(page.getByRole('option', { name: 'Apple' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Grape' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Pear' })).toBeHidden()
    expect(
      await page.evaluate(
        () => (globalThis as { searchCalls?: number }).searchCalls
      )
    ).toBe(1)
  })
})
