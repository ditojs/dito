import type { Locator, Page } from '@playwright/test'
import { DitoNestedList } from '../pages.js'
import type { TypeComponentDriver } from './index.js'

/** Field values by label, for the text fields of nested forms. */
export type Fields = Record<string, string>

/** An editing step on a list: add a row (of a form), remove or move one. */
export type ListStep =
  | { add: Fields; form?: string }
  | { remove: number }
  | { move: [number, number] }

async function fillFields(scope: Locator, fields: Fields) {
  for (const [label, value] of Object.entries(fields)) {
    await scope.getByLabel(label, { exact: true }).fill(value)
  }
}

/** Reads the text fields of a nested form, as values by label. */
function readFields(scope: Locator) {
  return scope.evaluate(element =>
    Object.fromEntries(
      [...element.querySelectorAll('input[aria-label]')].map(input => [
        input.getAttribute('aria-label'),
        (input as HTMLInputElement).value
      ])
    )
  )
}

function getList(page: Page, label: string) {
  return new DitoNestedList(page, label)
}

/**
 * Driver for inlined `list` components, with values as editing steps, read
 * back as the field values of each row.
 */
export const list: TypeComponentDriver = {
  getElement(page, { label }) {
    return page.getByRole('region', { name: label, exact: true })
  },

  async setValue(page, component, value) {
    const list = getList(page, component.label)
    for (const step of value as ListStep[]) {
      if ('add' in step) {
        await (step.form ? list.addType(step.form) : list.add())
        await fillFields(list.rows.last(), step.add)
      } else if ('remove' in step) {
        await list.delete(step.remove)
      } else {
        await list.dragRow(...step.move)
      }
    }
  },

  async getValue(page, component) {
    const { rows } = getList(page, component.label)
    const values = []
    for (const row of await rows.all()) {
      values.push(await readFields(row))
    }
    return values
  }
}

/** Driver for inlined `object` components, with values as field values. */
export const object: TypeComponentDriver = {
  getElement(page, { name }) {
    return page.locator(`[id="${name}"]`)
  },

  async setValue(page, component, value) {
    await fillFields(this.getElement(page, component), value as Fields)
  },

  async getValue(page, component) {
    return readFields(this.getElement(page, component))
  }
}
