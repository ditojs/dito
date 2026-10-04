import type { TypeComponentDriver } from './index.js'
import { getContainer } from './markup.js'

/** Driver for `code`, entering code into the editor's textarea. */
export const code: TypeComponentDriver = {
  getElement(page, component) {
    return getContainer(page, component).locator('textarea')
  },

  async setValue(page, component, value) {
    await this.getElement(page, component).fill(String(value))
  },

  async getValue(page, component) {
    return this.getElement(page, component).inputValue()
  }
}
