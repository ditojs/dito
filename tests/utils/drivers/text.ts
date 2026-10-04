import type { TypeComponentDriver } from './index.js'

/** Driver for all types rendered as a single text input. */
export const text: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByLabel(label, { exact: true })
  },

  async setValue(page, component, value) {
    await this.getElement(page, component).fill(String(value))
  },

  async getValue(page, component) {
    return this.getElement(page, component).inputValue()
  }
}
