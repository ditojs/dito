import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Playlist } from '../models/Playlist.js'
import { Track } from '../models/Track.js'
import { DitoForm, DitoNestedList } from '../../../utils/pages.js'

// Selects with `relate: true` relate to the tracks of the edited playlist,
// through `options.dataPath`, see `views.ts`.

async function openPlaylist(page: Page, url: string, playlist: Playlist) {
  await page.goto(`${url}/admin/music/playlists/${playlist.id}`)
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
}

// Leaving a dirty form asks for confirmation, which Playwright dismisses, so
// the form stays open.
async function expectToLeaveWithoutConfirmation(page: Page) {
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(/\/playlists$/)
}

async function getNextTrackTitles(playlist: Playlist) {
  const tracks = await Track.query()
    .where('playlistId', playlist.id)
    .withGraphFetched('nextTrack')
  return Object.fromEntries(
    tracks.map(track => [track.title, track.nextTrack?.title ?? null])
  )
}

test.describe('relate', () => {
  test('relates to new items of the edited data', async ({ page, url }) => {
    const playlist = await Playlist.query().insert({ name: 'Mix' })
    const form = new DitoForm(page)
    const tracks = new DitoNestedList(page, 'Tracks')
    await openPlaylist(page, url, playlist)
    await tracks.add()
    await tracks.rows
      .nth(0)
      .getByLabel('Title', { exact: true })
      .fill('Intro')
    await tracks.add()
    await tracks.rows
      .nth(1)
      .getByLabel('Title', { exact: true })
      .fill('Outro')
    // Both tracks are new, so neither has an id yet when it is selected.
    await tracks.rows
      .nth(0)
      .getByLabel('Next Track', { exact: true })
      .selectOption({ label: 'Outro' })
    await expect(
      tracks.rows.nth(0).getByLabel('Next Track Title', { exact: true })
    ).toHaveValue('Outro')
    await form.save()
    await expect
      .poll(() => getNextTrackTitles(playlist))
      .toEqual({ Intro: 'Outro', Outro: null })
  })

  test('replaces references with their options', async ({ page, url }) => {
    const playlist = await Playlist.query().insert({ name: 'Mix' })
    const outro = await Track.query().insert({
      playlistId: playlist.id,
      title: 'Outro',
      order: 1
    })
    await Track.query().insert({
      playlistId: playlist.id,
      title: 'Intro',
      order: 0,
      nextTrackId: outro.id
    })
    const form = new DitoForm(page)
    const tracks = new DitoNestedList(page, 'Tracks')
    await openPlaylist(page, url, playlist)
    // The server returns `nextTrack` as a reference, `{ id }`, see the
    // `withTracks` scope. Its title is only known once it is replaced with
    // its option.
    const intro = tracks.rows.nth(0)
    await expect(
      intro.getByLabel('Next Track', { exact: true }).locator('option:checked')
    ).toHaveText('Outro')
    await expect(
      intro.getByLabel('Next Track Title', { exact: true })
    ).toHaveValue('Outro')
    await intro.getByLabel('Title', { exact: true }).fill('Opening')
    await form.save()
    await expect
      .poll(() => getNextTrackTitles(playlist))
      .toEqual({ Opening: 'Outro', Outro: null })
  })

  test(`doesn't make forms dirty by replacing references`, async ({
    page,
    url
  }) => {
    const playlist = await Playlist.query().insert({ name: 'Mix' })
    const outro = await Track.query().insert({
      playlistId: playlist.id,
      title: 'Outro',
      order: 1
    })
    await Track.query().insert({
      playlistId: playlist.id,
      title: 'Intro',
      order: 0,
      nextTrackId: outro.id
    })
    await openPlaylist(page, url, playlist)
    const intro = new DitoNestedList(page, 'Tracks').rows.nth(0)
    await expect(
      intro.getByLabel('Next Track Title', { exact: true })
    ).toHaveValue('Outro')
    await expectToLeaveWithoutConfirmation(page)
  })

  test(`doesn't make forms dirty by numbering loaded items`, async ({
    page,
    url
  }) => {
    const playlist = await Playlist.query().insert({ name: 'Mix' })
    await Track.query().insert([
      { playlistId: playlist.id, title: 'Intro', order: null },
      { playlistId: playlist.id, title: 'Outro', order: null }
    ])
    await openPlaylist(page, url, playlist)
    await expect(new DitoNestedList(page, 'Tracks').rows).toHaveCount(2)
    await expectToLeaveWithoutConfirmation(page)
  })

  test('replaces forms with the forms of other views', async ({
    page,
    url
  }) => {
    // The playlist form is left while the track form is rendered, and must
    // not see the track form's schema, nor the track form its data.
    const playlist = await Playlist.query().insertGraph({
      name: 'Mix',
      tracks: [{ title: 'Intro', order: 0 }]
    })
    await openPlaylist(page, url, playlist)
    await page.getByRole('button', { name: 'Edit First Track' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/library/tracks/${playlist.tracks![0].id}$`)
    )
    await expect(page.getByLabel('Initial', { exact: true })).toHaveValue('I')
  })

  test('numbers loaded items with the offset of their page', async ({
    page,
    url
  }) => {
    await Playlist.query().insertGraph({
      name: 'Mix',
      tracks: ['A', 'B', 'C', 'D'].map((title, index) => ({
        title,
        order: index * 5
      }))
    })
    await page.goto(`${url}/admin/library/tracks?page=1`)
    const rows = page.locator('.dito-table tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('C')
    await expect(rows.nth(0)).toContainText('2')
    await expect(rows.nth(1)).toContainText('D')
    await expect(rows.nth(1)).toContainText('3')
  })
})
