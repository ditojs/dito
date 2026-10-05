import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures.js'
import { Playlist } from '../models/Playlist.js'
import { Track } from '../models/Track.js'
import { DitoForm, DitoNestedList } from '../../../utils/pages.js'

// Selects with `relate: true` relate to the tracks of the edited playlist,
// through `options.dataPath`, see `views.ts`.

async function openPlaylist(page: Page, url: string, playlist: Playlist) {
  await page.goto(`${url}/admin/playlists/${playlist.id}`)
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
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
})
