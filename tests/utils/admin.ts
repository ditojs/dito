import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

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

export function trackApiErrors(page: Page) {
  const errors: string[] = []
  page.on('response', resp => {
    if (
      resp.url().includes('/api/') &&
      resp.status() >= 400
    ) {
      errors.push(
        `${resp.status()} ${resp.url()}`
      )
    }
  })
  return {
    errors,
    expectNone() {
      expect(errors).toEqual([])
      errors.length = 0
    }
  }
}
