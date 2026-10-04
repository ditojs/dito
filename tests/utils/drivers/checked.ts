import type { TypeComponentDriver } from './index.js'
import { text } from './text.js'

/** Driver for `switch` and `checkbox`, with boolean values. */
export const checked: TypeComponentDriver = {
  getElement: text.getElement,

  async setValue(page, component, value) {
    await this.getElement(page, component).setChecked(Boolean(value))
  },

  async getValue(page, component) {
    return this.getElement(page, component).isChecked()
  }
}
