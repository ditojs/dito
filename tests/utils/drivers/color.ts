import { expect, type Page } from '@playwright/test'
import { text } from './text.js'
import type { DriverComponent, TypeComponentDriver } from './index.js'

/** Opens the color picker by clicking its input. */
export async function openColorPicker(page: Page, component: DriverComponent) {
  await text.getElement(page, component).click()
  const picker = page.getByRole('dialog', { name: 'Choose color' })
  await expect(picker).toBeVisible()
  return picker
}

/**
 * Driver for `color`: enters hex values into the input, or picks a preset
 * with `{ pick: '#ed1c24' }` or `{ pick: '#00000000' }`.
 */
export const color: TypeComponentDriver = {
  getElement: text.getElement,
  getValue: text.getValue,

  async setValue(page, component, value) {
    if (typeof value === 'string') {
      return text.setValue.call(this, page, component, value)
    }
    const { pick } = value as { pick: string }
    const picker = await openColorPicker(page, component)
    await picker.getByTitle(pick, { exact: true }).click()
    // Click an empty area to close the picker, so it doesn't cover the form.
    await page.mouse.click(1000, 400)
    await expect(picker).toBeHidden()
  }
}
