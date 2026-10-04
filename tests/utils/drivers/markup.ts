import { expect, type Page } from '@playwright/test'
import type { DriverComponent, TypeComponentDriver } from './index.js'

/** One editing step: text to type, a toolbar button, a key, or a link. */
export type MarkupStep =
  | string
  | { button: string }
  | { press: string }
  | { link: { text: string; href: string } }

/** Returns the type component's container, found by its label. */
export function getContainer(page: Page, { label }: DriverComponent) {
  return page.locator('.dito-container', {
    has: page.getByText(label, { exact: true })
  })
}

/**
 * Driver for `markup`: edits through the toolbar and keyboard, with a value
 * that is either text to type, or a list of editing steps. Values are HTML.
 */
export const markup: TypeComponentDriver = {
  getElement(page, component) {
    return getContainer(page, component).locator('.ProseMirror')
  },

  async setValue(page, component, value) {
    const editor = this.getElement(page, component)
    const container = getContainer(page, component)
    await editor.click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    for (const step of (Array.isArray(value) ? value : [value]) as MarkupStep[]) {
      if (typeof step === 'string') {
        await page.keyboard.type(step)
      } else if ('button' in step) {
        await container
          .getByRole('button', { name: step.button, exact: true })
          .click()
        // Buttons refocus the editor, wait for it before typing on.
        await expect(editor).toBeFocused()
      } else if ('press' in step) {
        await page.keyboard.press(step.press)
      } else if ('link' in step) {
        const { text, href } = step.link
        await page.keyboard.type(text)
        for (const _ of text) {
          await page.keyboard.press('Shift+ArrowLeft')
        }
        await container.getByRole('button', { name: 'Link', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await dialog.getByLabel('Link', { exact: true }).fill(href)
        await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
        await expect(dialog).toBeHidden()
        await page.keyboard.press('End')
      }
    }
  },

  async getValue(page, component) {
    return this.getElement(page, component).evaluate(element =>
      element.innerHTML.replace(/<br class="ProseMirror-trailingBreak">/g, '')
    )
  }
}
