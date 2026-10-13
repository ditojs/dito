import { test, expect } from '../fixtures.js'
import { getCase } from '../cases/index.js'
import { select } from '../../../utils/drivers/select.js'
import { multiselect } from '../../../utils/drivers/multiselect.js'
import { checkboxes } from '../../../utils/drivers/options.js'

// The groups of options with `options.group`, using the cases' views.

test.describe('grouped options', () => {
  const title = 'groups options with options.group'

  test('shows the groups of selects as option groups', async ({
    page,
    url
  }) => {
    const entry = getCase('select', title)
    await page.goto(`${url}/admin/${entry.path}`)
    const groups = select.getElement(page, entry).locator('optgroup')
    await expect(groups).toHaveCount(2)
    expect(
      await groups.evaluateAll(elements =>
        elements.map(element => [
          element.getAttribute('label'),
          [...element.querySelectorAll('option')].map(option => option.text)
        ])
      )
    ).toEqual([
      ['Fruit', ['Apple', 'Pear']],
      ['Vegetable', ['Carrot']]
    ])
  })

  test('shows the groups of multiselects in their dropdowns', async ({
    page,
    url
  }) => {
    const entry = getCase('multiselect', title)
    await page.goto(`${url}/admin/${entry.path}`)
    const element = multiselect.getElement(page, entry)
    await element.click()
    await expect(
      element.locator('.multiselect__option--group')
    ).toHaveText(['Fruit', 'Vegetable'])
  })

  test('lists the groups of checkboxes in fieldsets', async ({
    page,
    url
  }) => {
    const entry = getCase('checkboxes', title)
    await page.goto(`${url}/admin/${entry.path}`)
    const fieldsets = checkboxes.getElement(page, entry).locator('fieldset')
    await expect(fieldsets.locator('legend')).toHaveText([
      'Fruit',
      'Vegetable'
    ])
    await expect(fieldsets.first().locator('label')).toHaveText([
      'Apple',
      'Pear'
    ])
  })
})
