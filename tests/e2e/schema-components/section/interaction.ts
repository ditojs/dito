import {
  test, expect, createModelHelpers
} from '../fixtures.js'
import { LayoutWidget } from '../models/LayoutWidget.js'

const { seed } = createModelHelpers(
  LayoutWidget, 'layout-widgets'
)

test(
  'sectionCollapsible: collapse and expand',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value'
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    await expect(
      page.locator('.dito-section').first()
    ).toBeVisible({ timeout: 15_000 })

    // The collapsible section is the second
    // .dito-section--labelled on the page
    const section = page.locator(
      '.dito-section--labelled'
    ).nth(1)
    await expect(
      section.locator('.dito-schema--open')
    ).toBeVisible()

    // The label is teleported — find it by the
    // chevron it contains.
    const label = page.locator(
      'button.dito-label:has(.dito-chevron)'
    )
    await label.click()
    await expect(
      section.locator('.dito-schema--open')
    ).not.toBeVisible()

    await label.click()
    await expect(
      section.locator('.dito-schema--open')
    ).toBeVisible()
  }
)

test(
  'sectionNested: edit nested fields and persist',
  async ({ page, url }) => {
    const widgetId = await seed({
      sectionDetail: 'detail value',
      sectionNested: {
        street: '123 Main St',
        city: 'Springfield'
      }
    })

    await page.goto(
      `${url}/admin/layout/${widgetId}`
    )
    await expect(
      page.locator('.dito-section').first()
    ).toBeVisible({ timeout: 15_000 })

    // Nested section fields have dataPath-based
    // ids like "sectionNested/street"
    const streetInput = page.locator(
      'input[id$="street"]'
    )
    const cityInput = page.locator(
      'input[id$="city"]'
    )
    await streetInput.fill('456 Oak Ave')
    await cityInput.fill('Shelbyville')

    // Use the form's save button (last one),
    // not the submitBasic schema component
    const saved = page.waitForResponse(resp =>
      resp.url().includes(
        `/api/layout-widgets/${widgetId}`
      ) &&
      resp.request().method() === 'PATCH' &&
      resp.ok()
    )
    await page.locator(
      'button.dito-button[type="submit"]'
    ).last().click()
    await saved
    const widget = await LayoutWidget.query()
      .findById(widgetId)
    if (!widget) {
      throw new Error(
        `LayoutWidget ${widgetId} not found`
      )
    }
    expect(
      widget.sectionNested?.street
    ).toBe('456 Oak Ave')
    expect(
      widget.sectionNested?.city
    ).toBe('Shelbyville')
  }
)
