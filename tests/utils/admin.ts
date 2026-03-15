import type { Page, Locator } from '@playwright/test'

export function getInput(page: Page, name: string): Locator {
  return page.locator(
    `[id="${name}"] input, input[name="${name}"]`
  ).first()
}

export function getContainer(page: Page, name: string): Locator {
  return page.locator(
    `[id="${name}"]`
  ).locator('..').locator('..')
}
