import { fillDitoMultiselect } from '../pages.js'
import { getContainer } from './markup.js'
import type { TypeComponentDriver } from './index.js'

/** An option label to pick, or a new tag to add with `taggable`. */
export type MultiselectOption = string | { tag: string }

/**
 * Driver for `multiselect`, picking options by their label, or adding tags.
 * Values are a label, or a list of labels with `multiple`.
 */
export const multiselect: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByRole('combobox', { name: label, exact: true })
  },

  async setValue(page, component, value) {
    const options = (
      Array.isArray(value) ? value : [value]
    ) as MultiselectOption[]
    for (const option of options) {
      if (typeof option === 'string') {
        await fillDitoMultiselect(page, page, component.label, option)
      } else {
        const element = this.getElement(page, component)
        await element.click()
        await element.locator('input').fill(option.tag)
        await element.locator('input').press('Enter')
      }
    }
    // Close the dropdown, so it doesn't cover the form.
    await page.keyboard.press('Escape')
  },

  async getValue(page, component) {
    const container = getContainer(page, component)
    const tags = await container.locator('.multiselect__tag').allTextContents()
    return tags.length > 0
      ? tags.map(tag => tag.trim())
      : ((await container.locator('.multiselect__single').textContent()) ?? '')
          .trim()
  }
}
