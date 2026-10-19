import { test, expect } from '../fixtures.js'
import { Product } from '../models/Product.js'
import { DitoForm } from '../../../utils/pages.js'

test.describe('component forms', () => {
  test('load and save the item of their id', async ({ page, url }) => {
    const { id } = await Product.query().insert({ name: 'Chair', price: 120 })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/products/${id}`)
    await expect(form.getField('Name')).toHaveValue('Chair')
    await expect(page.locator('.product-summary')).toHaveText('Chair')
    await form.fill('Name', 'Stool')
    await form.save()
    await expect
      .poll(async () => (await Product.query().findById(id))?.name)
      .toBe('Stool')
  })

  test('create items and save them after', async ({ page, url }) => {
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/products`)
    await form.fill('Name', 'Table')
    await form.create()
    await expect(
      page.getByRole('button', { name: 'Save', exact: true })
    ).toBeVisible()
    await form.fill('Price', '300')
    await form.save()
    await expect
      .poll(() => Product.query().select('name', 'price'))
      .toEqual([{ name: 'Table', price: 300 }])
  })

  test('ask before leaving unsaved changes', async ({ page, url }) => {
    const { id } = await Product.query().insert({ name: 'Chair' })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/products/${id}`)
    await form.fill('Name', 'Stool')
    await expect(page.locator('.dito-trail__text--dirty')).toBeVisible()
    const menu = page.getByRole('navigation', { name: 'Main navigation' })
    await menu.getByRole('link', { name: 'Dashboard' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('You have unsaved changes.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(`${url}/admin/products/${id}`)
    await menu.getByRole('link', { name: 'Dashboard' }).click()
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(page).toHaveURL(`${url}/admin/dashboard`)
  })
})
