import { expect, type Locator, type Page } from '@playwright/test'
import { DitoNestedList } from '../pages.js'
import { acceptConfirmDialog, acceptConfirmDialogsDuring } from '../dialogs.js'
import type { TypeComponentDriver } from './index.js'
import { getContainer } from './markup.js'

/** Field values by label, for the text fields of nested forms. */
export type Fields = Record<string, string>

/**
 * An editing step in a nested form opened through its own route: fill its
 * fields, then leave it through a button, e.g. Apply or Cancel.
 */
export interface FormStep {
  fill: Fields
  then: string
}

/**
 * An editing step on a list: add a row (of a form), edit, remove or move one,
 * or create or open an item in its own form, for lists that aren't inlined.
 */
export type ListStep =
  | { add: Fields; form?: string }
  | { edit: number; fields: Fields }
  | { remove: number }
  | { move: [number, number] }
  | ({ create: true } & FormStep)
  | ({ open: number } & FormStep)

/**
 * An editing step on an object: remove it, or create or edit it in its own
 * form, for objects that aren't inlined.
 */
export type ObjectStep =
  | { remove: true }
  | (({ create: true } | { open: true }) & FormStep)

async function fillFields(scope: Locator, fields: Fields) {
  for (const [label, value] of Object.entries(fields)) {
    await scope.getByLabel(label, { exact: true }).fill(value)
  }
}

/**
 * Fills the form that a button navigated to, and leaves it through another.
 */
async function fillForm(page: Page, { fill, then }: FormStep) {
  // Nested forms are rendered after the forms they're nested in, which stay
  // in the DOM.
  const forms = page.locator('.dito-form')
  await expect(forms).toHaveCount(2)
  const form = forms.last()
  await fillFields(form, fill)
  // Accept the confirmation to discard changes when closing an edited form.
  await acceptConfirmDialogsDuring(page, async () => {
    await form.getByRole('button', { name: then, exact: true }).click()
    await expect(forms).toHaveCount(1)
  })
}

/**
 * Reads the text fields of a nested form, as values by label, or its text for
 * items that aren't inlined.
 */
function readFields(scope: Locator) {
  return scope.evaluate(element => {
    const inputs = [...element.querySelectorAll('input[aria-label]')]
    return inputs.length > 0
      ? Object.fromEntries(
          inputs.map(input => [
            input.getAttribute('aria-label'),
            (input as HTMLInputElement).value
          ])
        )
      : element.textContent?.trim()
  })
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
      } else if ('edit' in step) {
        await fillFields(list.rows.nth(step.edit), step.fields)
      } else if ('create' in step) {
        await list.add()
        await fillForm(page, step)
      } else if ('open' in step) {
        await list.edit(step.open)
        await fillForm(page, step)
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

/**
 * Driver for `object` components, with values as field values when inlined,
 * or as steps that create the object in its own form.
 */
export const object: TypeComponentDriver = {
  getElement(page, { name }) {
    return page.locator(`[id="${name}"]`)
  },

  async setValue(page, component, value) {
    const element = this.getElement(page, component)
    if ('create' in (value as object)) {
      await element.getByRole('button', { name: /Create|Add/ }).click()
      await fillForm(page, value as FormStep)
    } else if ('open' in (value as object)) {
      await element.getByRole('link', { name: 'Edit' }).click()
      await fillForm(page, value as FormStep)
    } else if ('remove' in (value as object)) {
      const button = element.getByRole('button', { name: 'Remove' })
      await element.hover()
      await button.click()
      await acceptConfirmDialog(page)
      await expect(button).toBeHidden()
    } else {
      await fillFields(element, value as Fields)
    }
  },

  async getValue(page, component) {
    return readFields(this.getElement(page, component))
  }
}

/** An editing step on a section: fill fields, or click a button. */
export type SectionStep = Fields | { click: string }

/**
 * Driver for nested `section` components, with values as field values, or
 * as steps that also click buttons.
 */
export const section: TypeComponentDriver = {
  getElement: getContainer,

  async setValue(page, component, value) {
    const scope = this.getElement(page, component)
    for (const step of (
      Array.isArray(value) ? value : [value]
    ) as SectionStep[]) {
      if ('click' in step && Object.keys(step).length === 1) {
        await scope
          .getByRole('button', { name: step.click as string, exact: true })
          .click()
      } else {
        await fillFields(scope, step as Fields)
      }
    }
  },

  async getValue(page, component) {
    return readFields(this.getElement(page, component))
  }
}

/** Driver for display-only components, reading their text or value. */
export const display: TypeComponentDriver = {
  getElement: getContainer,

  async setValue() {
    throw new Error('Display-only components have no value to set')
  },

  async getValue(page, component) {
    const element = this.getElement(page, component)
    const progress = element.locator('progress')
    return (await progress.count())
      ? progress.getAttribute('value')
      : (await element.textContent())?.trim()
  }
}
