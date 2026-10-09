import { test, expect } from '../fixtures.js'

test.describe('navigation', () => {
  test('opens sub-menus with the keyboard', async ({ page, url }) => {
    await page.goto(`${url}/admin/widgets`)
    const menu = page.getByRole('navigation', { name: 'Main navigation' })
    const gadgets = menu.getByRole('link', { name: 'Gadgets' })
    await expect(gadgets).toBeHidden()
    // The title link precedes the menu items.
    await menu.getByRole('link', { name: 'Dito.js Admin' }).focus()
    await page.keyboard.press('Tab')
    await expect(menu.getByRole('link', { name: 'Catalog' })).toBeFocused()
    await expect(gadgets).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(gadgets).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${url}/admin/catalog/gadgets`)
  })

  test('opens menu items in a new tab on modifier-click', async ({
    page,
    url
  }) => {
    await page.goto(`${url}/admin/widgets`)
    const menu = page.getByRole('navigation', { name: 'Main navigation' })
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      menu
        .getByRole('link', { name: 'Catalog' })
        .click({ modifiers: ['ControlOrMeta'] })
    ])
    await expect(newPage).toHaveURL(`${url}/admin/catalog/gadgets`)
    expect(page.url()).toBe(`${url}/admin/widgets`)
  })
})
