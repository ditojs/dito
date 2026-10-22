import { test, expect } from '../fixtures.js'
import { Designer } from '../models/Designer.js'
import { ShopSet } from '../models/ShopSet.js'
import { Collection } from '../models/Collection.js'
import {
  DitoForm,
  DitoNestedList,
  dragHandle
} from '../../../utils/pages.js'
import type { Page } from '@playwright/test'

const getContainer = (page: Page, label: string) =>
  page.locator('.dito-container').filter({
    has: page.locator(':scope > .dito-label', { hasText: label })
  })

const getErrors = (page: Page, label: string) =>
  getContainer(page, label).locator(':scope > .dito-errors')

test.describe('forms with properties and widgets', () => {
  test('load and save the data of the properties', async ({ page, url }) => {
    const { id } = await Designer.query().insert({
      name: 'Ada',
      awards: [{ title: 'Gold', year: 2020 }],
      address: { city: 'London' }
    })
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/designers/${id}`)
    await expect(form.getField('Name')).toHaveValue('Ada')
    // The properties mark the label, not the widget:
    await expect(
      getContainer(page, 'Name').locator('.dito-label--required')
    ).toBeVisible()
    await form.fill('Name', 'Grace')
    await form.fill('City', 'Paris')
    await awards.rows.first().locator('.dito-schema-header').click()
    await form.fill('Title', 'Silver')
    await form.save()
    await expect
      .poll(async () => {
        const designer = await Designer.query().findById(id)
        return {
          name: designer?.name,
          awards: designer?.awards,
          address: designer?.address
        }
      })
      .toEqual({
        name: 'Grace',
        awards: [{ title: 'Silver', year: 2020 }],
        address: { city: 'Paris' }
      })
  })

  test('create items with the defaults of the properties', async ({
    page,
    url
  }) => {
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/designers`)
    await expect(form.getField('Featured')).not.toBeChecked()
    await form.fill('Name', 'Ada')
    await awards.add()
    // New items open, with the defaults of their properties:
    await expect(form.getField('Title')).toHaveValue('')
    await form.fill('Title', 'Gold')
    await form.create()
    await expect
      .poll(() =>
        Designer.query().select('name', 'isFeatured', 'rank', 'awards')
      )
      .toEqual([
        {
          name: 'Ada',
          isFeatured: false,
          rank: null,
          awards: [{ title: 'Gold', year: null }]
        }
      ])
  })

  test('reveal errors in collapsed items', async ({
    page,
    url
  }) => {
    const { id } = await Designer.query().insert({
      name: 'Ada',
      isFeatured: true,
      rank: 3,
      awards: [{ title: 'Gold' }, { title: 'Silver' }]
    })
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/designers/${id}`)
    // Clear the title of the second award and collapse it again:
    const header = awards.rows.nth(1).locator('.dito-schema-header')
    await header.click()
    await form.fill('Title', '')
    await header.click()
    await expect(form.getField('Title')).toBeHidden()
    await form.save()
    await expect(getErrors(page, 'Title')).toHaveText(
      'The Title field is required.'
    )
    await expect(form.getField('Title')).toBeFocused()
    await expect(awards.rows.nth(1)).toHaveClass(/dito-table__row--error/)
  })

  test('reveal errors in collapsed sections', async ({ page, url }) => {
    const { id } = await Designer.query().insert({
      name: 'Ada',
      isFeatured: true,
      rank: 3
    })
    const form = new DitoForm(page)
    const ranking = page.locator('.dito-schema-header', { hasText: 'Ranking' })
    await page.goto(`${url}/admin/designers/${id}`)
    await expect(form.getField('Rank')).toBeHidden()
    await ranking.click()
    await form.fill('Rank', '0')
    await ranking.click()
    await expect(form.getField('Rank')).toBeHidden()
    await form.save()
    await expect(getErrors(page, 'Rank')).toHaveText(
      'The Rank field must be 1 or more.'
    )
    await expect(form.getField('Rank')).toBeFocused()
    // Collapsed again, the section marks its label in the color of errors:
    const errorColor = await getErrors(page, 'Rank').evaluate(
      element => getComputedStyle(element).color
    )
    const label = ranking.locator('.dito-label')
    await expect(label).not.toHaveCSS('color', errorColor)
    await ranking.click()
    await expect(form.getField('Rank')).toBeHidden()
    await expect(label).toHaveCSS('color', errorColor)
  })

  test('leave out the values of irrelevant properties', async ({
    page,
    url
  }) => {
    const { id } = await Designer.query().insert({
      name: 'Ada',
      isFeatured: true,
      rank: 3
    })
    const form = new DitoForm(page)
    const ranking = page.locator('.dito-schema-header', { hasText: 'Ranking' })
    await page.goto(`${url}/admin/designers/${id}`)
    await ranking.click()
    await form.fill('Rank', '0')
    // Without the feature, the rank hides, isn't validated and isn't sent:
    await form.toggleSwitch('Featured')
    await expect(form.getField('Rank')).toBeHidden()
    await form.save()
    await expect
      .poll(async () => {
        const designer = await Designer.query().findById(id)
        return [designer?.isFeatured, designer?.rank]
      })
      .toEqual([false, 3])
  })

  test('notify the errors that no widget shows', async ({ page, url }) => {
    const { id } = await Designer.query().insert({ name: 'Ada' })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/designers/${id}`)
    await form.fill('Email', 'ada')
    await page.getByRole('button', { name: 'Hide Contact' }).click()
    await expect(form.getField('Email')).toBeHidden()
    await form.save()
    await expect(
      form.getNotification({
        error: true,
        hasText: 'The field Email must be a valid email'
      })
    ).toBeVisible()
  })

  test('show the errors of the server at their widgets', async ({
    page,
    url
  }) => {
    const { id } = await Designer.query().insert({
      name: 'Ada',
      awards: [{ title: 'Gold' }]
    })
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/designers/${id}`)
    await form.fill('Name', 'Ada Lovelace, Countess of Lovelace')
    await awards.rows.first().locator('.dito-schema-header').click()
    await form.fill('Title', 'Analytical Engine Award')
    // Collapse the award again, the server's error reveals it:
    await awards.rows.first().locator('.dito-schema-header').click()
    await form.save()
    await expect(getErrors(page, 'Name')).toContainText('20')
    await expect(getErrors(page, 'Title')).toContainText('12')
    await expect
      .poll(async () => (await Designer.query().findById(id))?.name)
      .toBe('Ada')
  })
})

test.describe('lists of several kinds in forms with properties', () => {
  test('create the items of each kind with their defaults', async ({
    page,
    url
  }) => {
    const form = new DitoForm(page)
    const cuts = new DitoNestedList(page, 'Cuts')
    const prices = new DitoNestedList(page, 'Prices')
    await page.goto(`${url}/admin/shop-sets`)
    await form.fill('Name', 'Starter')
    await prices.add()
    await form.fill('Price', '40')
    await cuts.addType('Bundle')
    await expect(form.getField('Discount')).toHaveValue('10')
    await form.fill('Title', 'Duo')
    await cuts.addType('Style')
    await form.fill('Style Name', 'Regular')
    await form.create()
    await expect
      .poll(() => ShopSet.query().select('name', 'prices', 'cuts'))
      .toEqual([
        {
          name: 'Starter',
          prices: [40],
          cuts: [
            { type: 'bundle', title: 'Duo', discount: 10 },
            { type: 'style', name: 'Regular' }
          ]
        }
      ])
  })

  test('validate the items while they are collapsed', async ({
    page,
    url
  }) => {
    const { id } = await ShopSet.query().insert({
      name: 'Starter',
      prices: [40],
      cuts: [
        { type: 'style', name: 'Regular' },
        { type: 'bundle', title: 'Duo', discount: 10 }
      ]
    })
    const form = new DitoForm(page)
    const cuts = new DitoNestedList(page, 'Cuts')
    await page.goto(`${url}/admin/shop-sets/${id}`)
    const header = cuts.rows.nth(1).locator('.dito-schema-header')
    await header.click()
    await form.fill('Title', '')
    await header.click()
    await form.fill('Price', '-5')
    // Leave the price first, as its error moves the button on blur:
    await form.getField('Price').blur()
    await form.save()
    await expect(getErrors(page, 'Title')).toHaveText(
      'The Title field is required.'
    )
    await expect(getErrors(page, 'Price')).toHaveText(
      'The Price field must be 0 or more.'
    )
  })
})

test.describe('trees in forms with properties', () => {
  const getTreeHeader = (page: Page, label: string) =>
    page.locator('.dito-tree-item__header').filter({
      has: page.locator('.dito-tree-item__label', { hasText: label })
    })

  test('edit the selected items in the forms of their slots', async ({
    page,
    url
  }) => {
    const { id } = await Collection.query().insert({
      name: 'Fonts',
      shopSets: [
        { name: 'Sans', cuts: [{ name: 'Regular' }, { name: 'Bold' }] },
        { name: 'Serif', cuts: [] }
      ]
    })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/collections/${id}`)
    await page.getByRole('button', { name: 'Sans' }).click()
    const header = getTreeHeader(page, 'Bold')
    await header.hover()
    await header.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/collections\/\d+\/shop-sets\/0\/cuts\/1$/)
    await expect(form.getField('Cut')).toHaveValue('Bold')
    await form.fill('Cut', 'Black')
    await expect(getTreeHeader(page, 'Black')).toBeVisible()
    await page.reload()
    // The reload loses the edit, and opens the form of the link again:
    await expect(form.getField('Cut')).toHaveValue('Bold')
    await form.fill('Cut', 'Black')
    await form.save()
    await expect
      .poll(async () => (await Collection.query().findById(id))?.shopSets)
      .toEqual([
        { name: 'Sans', cuts: [{ name: 'Regular' }, { name: 'Black' }] },
        { name: 'Serif', cuts: [] }
      ])
  })

  test('reorder the items of draggable levels only', async ({ page, url }) => {
    const { id } = await Collection.query().insert({
      name: 'Fonts',
      shopSets: [
        { name: 'Sans', cuts: [{ name: 'Regular' }, { name: 'Bold' }] },
        { name: 'Serif', cuts: [] }
      ]
    })
    await page.goto(`${url}/admin/collections/${id}`)
    await page.getByRole('button', { name: 'Sans' }).click()
    const getHandle = (label: string) =>
      getTreeHeader(page, label).locator('.dito-button[title="Drag"]')
    await expect(getHandle('Sans')).toHaveCount(0)
    await getTreeHeader(page, 'Regular').hover()
    await dragHandle(page, getHandle('Regular'), getHandle('Bold'))
    await new DitoForm(page).save()
    await expect
      .poll(async () => (await Collection.query().findById(id))?.shopSets)
      .toEqual([
        { name: 'Sans', cuts: [{ name: 'Bold' }, { name: 'Regular' }] },
        { name: 'Serif', cuts: [] }
      ])
  })

  test('reveal errors in the forms of their items', async ({ page, url }) => {
    const { id } = await Collection.query().insert({
      name: 'Fonts',
      shopSets: [{ name: 'Sans', cuts: [{ name: '' }] }]
    })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/collections/${id}`)
    await form.fill('Name', 'Types')
    await form.save()
    await expect(page).toHaveURL(/\/shop-sets\/0\/cuts\/0$/)
    await expect(getErrors(page, 'Cut')).toHaveText(
      'The Cut field is required.'
    )
  })
})
