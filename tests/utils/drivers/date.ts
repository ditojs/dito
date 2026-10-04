import type { TypeComponentDriver } from './index.js'
import { text } from './text.js'

/**
 * Driver for `date`, `datetime` and `time`: types the value into the input,
 * in the displayed format, and closes the picker.
 */
export const date: TypeComponentDriver = {
  getElement: text.getElement,
  getValue: text.getValue,

  async setValue(page, component, value) {
    const element = this.getElement(page, component)
    await element.fill(String(value))
    await element.press('Enter')
  }
}
