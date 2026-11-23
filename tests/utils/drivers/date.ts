import type { TypeComponentDriver } from './index.js'

/**
 * Driver for `date`, `datetime` and `time`, whose fields edit each part of the
 * value on its own: types the numbers and the day period of the value into the
 * parts, starting at the first, e.g. `5/14/2026, 11:30:00 AM`.
 */
export const date: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByRole('group', { name: label, exact: true })
  },

  async setValue(page, component, value) {
    await this.getElement(page, component)
      .getByRole('spinbutton')
      .first()
      .click()
    // Full numbers move the focus on to the next part:
    for (const token of String(value).match(/\d+|AM|PM/g) ?? []) {
      await page.keyboard.type(
        token.length === 1 && /\d/.test(token) ? token.padStart(2, '0') : token
      )
    }
  },

  async getValue(page, component) {
    return (await this.getElement(page, component).textContent())?.trim()
  }
}
