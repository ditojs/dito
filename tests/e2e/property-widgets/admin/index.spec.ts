import { test, expect, db } from '../fixtures.js'
import { Author } from '../models/Author.js'
import { Volume } from '../models/Volume.js'
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
    const { id } = await db.insert(Author, {
      name: 'Ada',
      awards: [{ title: 'Gold', year: 2020 }],
      address: { city: 'London' }
    })
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/authors/${id}`)
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
        const author = await db.findOne(Author, id)
        return {
          name: author?.name,
          awards: author?.awards,
          address: author?.address
        }
      })
      .toEqual({
        name: 'Grace',
        awards: [{ title: 'Silver', year: 2020 }],
        address: { city: 'Paris' }
      })
  })

  test('display content without a value, with the layout options', async ({
    page,
    url
  }) => {
    const { id } = await db.insert(Author, { name: 'Ada' })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/authors/${id}`)
    const profile = getContainer(page, 'Profile')
    await expect(profile.locator('.author-profile')).toHaveText('Ada')
    await form.fill('Name', 'Grace')
    await expect(profile.locator('.author-profile')).toHaveText('Grace')
    // `break: 'before'` starts a new line, although the widget would fit:
    const nameBox = await getContainer(page, 'Name').boundingBox()
    const profileBox = await profile.boundingBox()
    expect(profileBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height - 1)
    expect(profileBox!.width).toBeCloseTo(nameBox!.width / 2, 0)
  })

  test('create items with the defaults of the properties', async ({
    page,
    url
  }) => {
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/authors`)
    await expect(form.getField('Featured')).not.toBeChecked()
    await form.fill('Name', 'Ada')
    await awards.add()
    // New items open, with the defaults of their properties:
    await expect(form.getField('Title')).toHaveValue('')
    await form.fill('Title', 'Gold')
    await form.create()
    await expect
      .poll(async () =>
        (await db.find(Author, {})).map(
          ({ name, isFeatured, rank, awards }) => ({
            name,
            isFeatured,
            rank,
            awards
          })
        )
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
    const { id } = await db.insert(Author, {
      name: 'Ada',
      isFeatured: true,
      rank: 3,
      awards: [{ title: 'Gold' }, { title: 'Silver' }]
    })
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/authors/${id}`)
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
    const { id } = await db.insert(Author, {
      name: 'Ada',
      isFeatured: true,
      rank: 3
    })
    const form = new DitoForm(page)
    const ranking = page.locator('.dito-schema-header', { hasText: 'Ranking' })
    await page.goto(`${url}/admin/authors/${id}`)
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
    const { id } = await db.insert(Author, {
      name: 'Ada',
      isFeatured: true,
      rank: 3
    })
    const form = new DitoForm(page)
    const ranking = page.locator('.dito-schema-header', { hasText: 'Ranking' })
    await page.goto(`${url}/admin/authors/${id}`)
    await ranking.click()
    await form.fill('Rank', '0')
    // Without the feature, the rank hides, isn't validated and isn't sent:
    await form.toggleSwitch('Featured')
    await expect(form.getField('Rank')).toBeHidden()
    await form.save()
    await expect
      .poll(async () => {
        const author = await db.findOne(Author, id)
        return [author?.isFeatured, author?.rank]
      })
      .toEqual([false, 3])
  })

  test('notify the errors that no widget shows', async ({ page, url }) => {
    const { id } = await db.insert(Author, { name: 'Ada' })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/authors/${id}`)
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
    const { id } = await db.insert(Author, {
      name: 'Ada',
      awards: [{ title: 'Gold' }]
    })
    const form = new DitoForm(page)
    const awards = new DitoNestedList(page, 'Awards')
    await page.goto(`${url}/admin/authors/${id}`)
    await form.fill('Name', 'Ada Lovelace, Countess of Lovelace')
    await awards.rows.first().locator('.dito-schema-header').click()
    await form.fill('Title', 'Analytical Engine Award')
    // Collapse the award again, the server's error reveals it:
    await awards.rows.first().locator('.dito-schema-header').click()
    await form.save()
    await expect(getErrors(page, 'Name')).toContainText('20')
    await expect(getErrors(page, 'Title')).toContainText('12')
    await expect
      .poll(async () => (await db.findOne(Author, id))?.name)
      .toBe('Ada')
  })
})

test.describe('lists of several kinds in forms with properties', () => {
  test('create the items of each kind with their defaults', async ({
    page,
    url
  }) => {
    const form = new DitoForm(page)
    const chapters = new DitoNestedList(page, 'Chapters')
    const prices = new DitoNestedList(page, 'Prices')
    await page.goto(`${url}/admin/volumes`)
    await form.fill('Name', 'Starter')
    await prices.add()
    await form.fill('Price', '40')
    await chapters.addType('Bundle')
    await expect(form.getField('Discount')).toHaveValue('10')
    await form.fill('Title', 'Duo')
    await chapters.addType('Section')
    await form.fill('Section Name', 'Preface')
    await form.create()
    await expect
      .poll(async () =>
        (await db.find(Volume, {})).map(({ name, prices, chapters }) => ({
          name,
          prices,
          chapters
        }))
      )
      .toEqual([
        {
          name: 'Starter',
          prices: [40],
          chapters: [
            { type: 'bundle', title: 'Duo', discount: 10 },
            { type: 'section', name: 'Preface' }
          ]
        }
      ])
  })

  test('validate the items while they are collapsed', async ({
    page,
    url
  }) => {
    const { id } = await db.insert(Volume, {
      name: 'Starter',
      prices: [40],
      chapters: [
        { type: 'section', name: 'Preface' },
        { type: 'bundle', title: 'Duo', discount: 10 }
      ]
    })
    const form = new DitoForm(page)
    const chapters = new DitoNestedList(page, 'Chapters')
    await page.goto(`${url}/admin/volumes/${id}`)
    const header = chapters.rows.nth(1).locator('.dito-schema-header')
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
    const { id } = await db.insert(Collection, {
      name: 'books',
      volumes: [
        { name: 'Poetry', chapters: [{ name: 'Preface' }, { name: 'Body' }] },
        { name: 'Prose', chapters: [] }
      ]
    })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/collections/${id}`)
    await page.getByRole('button', { name: 'Poetry' }).click()
    const header = getTreeHeader(page, 'Body')
    await header.hover()
    await header.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/collections\/\d+\/volumes\/0\/chapters\/1$/)
    await expect(form.getField('Chapter')).toHaveValue('Body')
    await form.fill('Chapter', 'Back')
    await expect(getTreeHeader(page, 'Back')).toBeVisible()
    await page.reload()
    // The reload loses the edit, and opens the form of the link again:
    await expect(form.getField('Chapter')).toHaveValue('Body')
    await form.fill('Chapter', 'Back')
    await form.save()
    await expect
      .poll(async () => (await db.findOne(Collection, id))?.volumes)
      .toEqual([
        { name: 'Poetry', chapters: [{ name: 'Preface' }, { name: 'Back' }] },
        { name: 'Prose', chapters: [] }
      ])
  })

  test('reorder the items of draggable levels only', async ({ page, url }) => {
    const { id } = await db.insert(Collection, {
      name: 'books',
      volumes: [
        { name: 'Poetry', chapters: [{ name: 'Preface' }, { name: 'Body' }] },
        { name: 'Prose', chapters: [] }
      ]
    })
    await page.goto(`${url}/admin/collections/${id}`)
    await page.getByRole('button', { name: 'Poetry' }).click()
    const getHandle = (label: string) =>
      getTreeHeader(page, label).locator('.dito-button[title="Drag"]')
    await expect(getHandle('Poetry')).toHaveCount(0)
    await getTreeHeader(page, 'Preface').hover()
    await dragHandle(page, getHandle('Preface'), getHandle('Body'))
    await new DitoForm(page).save()
    await expect
      .poll(async () => (await db.findOne(Collection, id))?.volumes)
      .toEqual([
        { name: 'Poetry', chapters: [{ name: 'Body' }, { name: 'Preface' }] },
        { name: 'Prose', chapters: [] }
      ])
  })

  test('reveal errors in the forms of their items', async ({ page, url }) => {
    const { id } = await db.insert(Collection, {
      name: 'books',
      volumes: [{ name: 'Poetry', chapters: [{ name: '' }] }]
    })
    const form = new DitoForm(page)
    await page.goto(`${url}/admin/collections/${id}`)
    await form.fill('Name', 'Types')
    await form.save()
    await expect(page).toHaveURL(/\/volumes\/0\/chapters\/0$/)
    await expect(getErrors(page, 'Chapter')).toHaveText(
      'The Chapter field is required.'
    )
  })
})
