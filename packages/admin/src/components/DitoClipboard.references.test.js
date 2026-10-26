import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { copyClipboardData, getClipboardData } from '../utils/clipboard.js'
import { mountForm } from '../test/mount.js'

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

describe('DitoClipboard, items that reference records by their id', () => {
  const albums = [
    { id: 12, name: 'Blue' },
    { id: 34, name: 'Kind of Blue' }
  ]

  // The items of `albums` reference albums by the field of their id, those of
  // `tracks` are ordinary items:
  async function mountPlaylistForm({ data, idKey = 'id' }) {
    const result = await mountForm({
      schema: {
        name: 'playlist',
        clipboard: true,
        fields: {
          title: { type: 'text' },
          albums: {
            type: 'list',
            inlined: true,
            creatable: true,
            clipboard: true,
            idKey,
            orderKey: 'order',
            form: {
              type: 'form',
              name: 'album',
              clipboard: true,
              fields: {
                [idKey]: {
                  type: 'select',
                  label: 'Album',
                  required: true,
                  options: {
                    data: ({ request }) => request({ url: 'albums' }),
                    value: 'id',
                    label: 'name'
                  }
                },
                discount: { type: 'number' }
              }
            }
          },
          tracks: {
            type: 'list',
            inlined: true,
            form: { type: 'form', fields: { name: { type: 'text' } } }
          }
        }
      },
      data,
      request: ({ method = 'get', url, data }) =>
        method === 'get' && url === 'albums' ? { data: albums } : { data }
    })
    const { wrapper, findContainer } = result
    const click = async (selector, button) => {
      await wrapper
        .find(`${selector} .dito-button--${button}`)
        .trigger('click')
      await flushPromises()
    }
    return {
      ...result,
      copy: () => click('.dito-clipboard', 'copy'),
      paste: () => click('.dito-clipboard', 'paste'),
      async pasteAlbums() {
        await findContainer('albums')
          .find('.dito-label .dito-button--paste')
          .trigger('click')
        await flushPromises()
      },
      // Inlined items only show their buttons when hovered:
      async clickItem(index, button) {
        const item = findContainer('albums').findAll('.dito-schema-inlined')[
          index
        ]
        await item.trigger('mouseenter')
        await item
          .find(`.dito-clipboard .dito-button--${button}`)
          .trigger('click')
        await flushPromises()
      },
      async copyAlbums() {
        await findContainer('albums')
          .find('.dito-label .dito-button--copy')
          .trigger('click')
        await flushPromises()
      }
    }
  }

  const createPlaylist = (idKey = 'id') => ({
    title: 'Grotesques',
    albums: [
      { [idKey]: 12, order: 0, discount: 10 },
      { [idKey]: 34, order: 1, discount: 0 }
    ],
    tracks: [{ id: 7, name: 'So What' }]
  })

  const emptyPlaylist = { title: 'Other', albums: [], tracks: [] }

  beforeEach(() => {
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await copyClipboardData('reset', null)
    vi.restoreAllMocks()
  })

  const copiedAlbums = [
    { $label: 'Blue', order: 0, discount: 10 },
    { $label: 'Kind of Blue', order: 1, discount: 0 }
  ]

  it('copies the labels of the referenced records instead of ids', async () => {
    const { copy } = await mountPlaylistForm({ data: createPlaylist() })
    await copy()
    expect(getClipboardData('playlist')).toEqual({
      title: 'Grotesques',
      albums: copiedAlbums,
      // Ordinary items lose their ids:
      tracks: [{ name: 'So What' }]
    })
  })

  it('pastes the references into another record', async () => {
    const { paste, submit } = await mountPlaylistForm({ data: emptyPlaylist })
    await copyClipboardData('playlist', {
      title: 'Grotesques',
      albums: copiedAlbums,
      tracks: [{ name: 'So What' }]
    })
    await paste()
    expect(getNotificationTexts()).toEqual([])
    expect(await submit()).toMatchObject({
      title: 'Grotesques',
      albums: [
        { id: 12, order: 0, discount: 10 },
        { id: 34, order: 1, discount: 0 }
      ],
      tracks: [{ name: 'So What' }]
    })
  })

  it('copies and pastes the items of the list of references', async () => {
    const { copyAlbums, pasteAlbums, data } = await mountPlaylistForm({
      data: createPlaylist()
    })
    await copyAlbums()
    expect(getClipboardData('albums', 'list')).toEqual({ items: copiedAlbums })
    data.albums.splice(0)
    await pasteAlbums()
    expect(data.albums).toEqual([
      { id: 12, order: 0, discount: 10 },
      { id: 34, order: 1, discount: 0 }
    ])
  })

  it('references records by the `idKey` of the list', async () => {
    const { copy, paste, data } = await mountPlaylistForm({
      data: createPlaylist('uid'),
      idKey: 'uid'
    })
    await copy()
    expect(getClipboardData('playlist').albums).toEqual(copiedAlbums)
    data.albums = []
    await paste()
    expect(data.albums).toEqual([
      { uid: 12, order: 0, discount: 10 },
      { uid: 34, order: 1, discount: 0 }
    ])
  })

  it('pastes items of unknown labels without their reference', async () => {
    const { paste, data } = await mountPlaylistForm({ data: emptyPlaylist })
    await copyClipboardData('playlist', {
      albums: [
        { $label: 'Blue', order: 0, discount: 10 },
        { $label: 'Bitches Brew', order: 1, discount: 5 }
      ]
    })
    await paste()
    expect(data.albums).toEqual([
      { id: 12, order: 0, discount: 10 },
      { id: null, order: 1, discount: 5 }
    ])
    expect(getNotificationTexts().join()).toContain(
      `Not found when pasting: Album 'Bitches Brew'`
    )
  })

  it('pastes the reference into the form of an item', async () => {
    const { clickItem, data, submit } = await mountPlaylistForm({
      data: createPlaylist()
    })
    await clickItem(0, 'copy')
    expect(getClipboardData('album')).toEqual(copiedAlbums[0])
    // The pasted record replaces the one that the item references:
    await clickItem(1, 'paste')
    expect(data.albums[1]).toEqual({ id: 12, order: 1, discount: 10 })
    expect((await submit()).albums).toEqual([
      { id: 12, order: 0, discount: 10 },
      { id: 12, order: 1, discount: 10 }
    ])
  })

  it('keeps the reference of the item for unknown labels', async () => {
    const { clickItem, data } = await mountPlaylistForm({
      data: createPlaylist()
    })
    await copyClipboardData('album', { $label: 'Bitches Brew', discount: 5 })
    await clickItem(1, 'paste')
    expect(data.albums[1]).toEqual({ id: 34, order: 1, discount: 5 })
    expect(getNotificationTexts().join()).toContain(
      `Not found when pasting: Album 'Bitches Brew'`
    )
  })
})
