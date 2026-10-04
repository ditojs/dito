import type { Locator } from '@playwright/test'
import type { TypeComponentDriver } from './index.js'

function getLabels(inputs: Locator) {
  return inputs.evaluateAll(elements =>
    elements.map(element => element.closest('label')?.textContent?.trim())
  )
}

/** Driver for `radio`, checking and reading options by their label. */
export const radio: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByRole('radiogroup', { name: label, exact: true })
  },

  async setValue(page, component, value) {
    await this.getElement(page, component)
      .getByLabel(String(value), { exact: true })
      .check()
  },

  async getValue(page, component) {
    const [label = ''] = await getLabels(
      this.getElement(page, component).locator('input:checked')
    )
    return label
  }
}

/**
 * Driver for `checkboxes`, with values as lists of option labels to check,
 * unchecking all others.
 */
export const checkboxes: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByRole('group', { name: label, exact: true })
  },

  async setValue(page, component, value) {
    const inputs = this.getElement(page, component).getByRole('checkbox')
    const labels = await getLabels(inputs)
    for (const [index, label] of labels.entries()) {
      await inputs
        .nth(index)
        .setChecked((value as string[]).includes(label!))
    }
  },

  async getValue(page, component) {
    return getLabels(
      this.getElement(page, component).locator('input:checked')
    )
  }
}
