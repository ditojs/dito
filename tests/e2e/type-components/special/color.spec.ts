import { test, expect } from '../fixtures.js'
import { Case } from '../models/Case.js'
import { getCase } from '../cases/index.js'
import { openColorPicker } from '../../../utils/drivers/color.js'
import { text } from '../../../utils/drivers/text.js'

// Color picker behavior beyond value round-trips, using the cases' views.

test.describe('color picker', () => {
  test('picker changes update the input after typing', async ({
    page,
    url
  }) => {
    const entry = getCase('color', 'stores typed hex as lowercase hex')
    await page.goto(`${url}/admin/${entry.path}`)
    const picker = await openColorPicker(page, entry)
    const input = text.getElement(page, entry)
    await input.fill('ff0000')
    await expect(picker.getByLabel('Hex', { exact: true })).toHaveValue(
      'ff0000'
    )
    await picker.getByLabel('Color:#00a2e8', { exact: true }).click()
    await expect(input).toHaveValue('00a2e8')
  })

  test('picker shows the hex value in lowercase', async ({ page, url }) => {
    const entry = getCase('color', 'shows a stored value without hash')
    await Case.query().patch({ [entry.name]: '#00A2E8' }).findById(1)
    await page.goto(`${url}/admin/${entry.path}`)
    const picker = await openColorPicker(page, entry)
    await expect(picker.getByLabel('Hex', { exact: true })).toHaveValue(
      '00a2e8'
    )
  })

  test('clear button shows when hovering the input, not the picker', async ({
    page,
    url
  }) => {
    const entry = getCase('color', 'is clearable with clearable')
    await Case.query().patch({ [entry.name]: entry.seed }).findById(1)
    await page.goto(`${url}/admin/${entry.path}`)
    const picker = await openColorPicker(page, entry)
    const clear = page.getByRole('button', { name: 'Clear' })
    await text.getElement(page, entry).hover()
    await expect(clear).toBeVisible()
    await picker.hover()
    await expect(clear).toBeHidden()
  })
})
