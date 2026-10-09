import type { TypeComponentDriver } from './index.js'

/**
 * Driver for `slider`, entering values into its number input, as filling the
 * range input doesn't trigger input events. The range input holds the label of
 * the field, the number input is labeled '<label> Value'.
 */
export const slider: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByRole('spinbutton', {
      name: `${label} Value`,
      exact: true
    })
  },

  async setValue(page, component, value) {
    const element = this.getElement(page, component)
    await element.fill(String(value))
    await element.press('Tab')
  },

  async getValue(page, component) {
    return this.getElement(page, component).inputValue()
  }
}
