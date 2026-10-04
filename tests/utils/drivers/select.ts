import type { TypeComponentDriver } from './index.js'
import { text } from './text.js'

/** Driver for `select`, selecting and reading options by their label. */
export const select: TypeComponentDriver = {
  getElement: text.getElement,

  async setValue(page, component, value) {
    await this.getElement(page, component).selectOption({
      label: String(value)
    })
  },

  async getValue(page, component) {
    return this.getElement(page, component).evaluate(
      (element: HTMLSelectElement) => element.selectedOptions[0]?.text ?? ''
    )
  }
}
