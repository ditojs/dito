import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Album } from '../models/Album.js'
import { DitoForm } from '../../../utils/pages.js'

async function openAlbum(page: Page, url: string, album: Partial<Album>) {
  const { id } = await Album.query().insert({ title: 'Album', ...album })
  await page.goto(`${url}/admin/albums/${id}`)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    album.title ?? 'Album'
  )
  return id
}

/** The innermost form, e.g. a nested form. */
function getForm(page: Page) {
  return page.locator('.dito-form').last()
}

async function getStoredAlbum(id: number) {
  return Album.query().findById(id)
}

test.describe('nested forms', () => {
  test('stores data set on transient forms', async ({ page, url }) => {
    const id = await openAlbum(page, url, {
      tracks: [{ title: 'Intro' }]
    })
    await page
      .getByRole('region', { name: 'Tracks', exact: true })
      .getByRole('link', { name: 'Edit' })
      .click()
    await getForm(page).getByRole('button', { name: 'Fill Length' }).click()
    await expect(
      getForm(page).getByLabel('Length', { exact: true })
    ).toHaveValue(
      '3:30'
    )
    await getForm(page)
      .getByRole('button', { name: 'Apply', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/albums/${id}$`))
    await new DitoForm(page).save()
    expect((await getStoredAlbum(id))?.tracks).toEqual([
      { title: 'Intro', length: '3:30' }
    ])
  })

  test('applies data set on transient forms to the parent right away', async ({
    page,
    url
  }) => {
    // `setData()` on transient forms sets the data of their source, see
    // `DitoForm.setData()`, so closing the form keeps it.
    const id = await openAlbum(page, url, {
      tracks: [{ title: 'Intro' }]
    })
    await page
      .getByRole('region', { name: 'Tracks', exact: true })
      .getByRole('link', { name: 'Edit' })
      .click()
    await getForm(page).getByRole('button', { name: 'Fill Length' }).click()
    await expect(
      getForm(page).getByLabel('Length', { exact: true })
    ).toHaveValue('3:30')
    await getForm(page)
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/albums/${id}$`))
    await new DitoForm(page).save()
    expect((await getStoredAlbum(id))?.tracks).toEqual([
      { title: 'Intro', length: '3:30' }
    ])
  })

  test('stores items edited in nested forms of panels', async ({
    page,
    url
  }) => {
    const id = await openAlbum(page, url, {
      credits: [{ name: 'Ada', role: 'Producer' }]
    })
    const panel = page.getByRole('region', { name: 'Credits', exact: true })
    await panel.getByRole('link', { name: 'Edit' }).click()
    await getForm(page).getByLabel('Role', { exact: true }).fill('Engineer')
    await getForm(page)
      .getByRole('button', { name: 'Apply', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/albums/${id}$`))
    await new DitoForm(page).save()
    expect((await getStoredAlbum(id))?.credits).toEqual([
      { name: 'Ada', role: 'Engineer' }
    ])
  })
})
