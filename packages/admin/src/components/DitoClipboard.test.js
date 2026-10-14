import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'
import { copyClipboardData, getClipboardData } from '../utils/clipboard.js'
import { mountForm, settle, isForm } from '../test/mount.js'

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

async function mountBookForm(clipboard = true) {
  const result = await mountForm({
    schema: {
      clipboard,
      components: { title: { type: 'text' } }
    },
    data: { title: 'Emma' }
  })
  const { wrapper } = result
  return {
    ...result,
    copyButton: wrapper.find('.dito-clipboard .dito-button--copy'),
    pasteButton: wrapper.find('.dito-clipboard .dito-button--paste')
  }
}

describe('DitoClipboard', () => {
  const isChrome = appState.agent.chrome
  let alert

  beforeEach(() => {
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
    alert = vi.fn()
    vi.stubGlobal('alert', alert)
  })

  afterEach(async () => {
    appState.agent.chrome = isChrome
    await copyClipboardData('reset', null)
    vi.restoreAllMocks()
  })

  it('pastes copied data, also without a system clipboard', async () => {
    const { copyButton, pasteButton, findField } = await mountBookForm()
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(
      new Error('Read permission denied')
    )
    expect(pasteButton.attributes('disabled')).toBeDefined()
    await copyButton.trigger('click')
    await flushPromises()
    expect(pasteButton.attributes('disabled')).toBeUndefined()
    const input = findField('title').find('input')
    await input.setValue('Persuasion')
    await pasteButton.trigger('click')
    await flushPromises()
    expect(input.element.value).toBe('Emma')
  })

  it(`doesn't make the data dirty by pasting the same values`, async () => {
    const { copyButton, pasteButton, dataModel } = await mountBookForm()
    await copyButton.trigger('click')
    await flushPromises()
    await pasteButton.trigger('click')
    await flushPromises()
    expect(dataModel.isDirty).toBe(false)
  })

  it('pastes the result of `clipboard.paste()` as new items', async () => {
    const paste = vi.fn(({ clipboardItem }) => clipboardItem)
    const { wrapper, data, dataModel } = await mountForm({
      schema: {
        clipboard: { paste },
        components: {
          authors: {
            type: 'list',
            inlined: true,
            form: { type: 'form', components: { name: { type: 'text' } } }
          },
          mainAuthor: {
            type: 'select',
            relate: true,
            options: { dataPath: 'authors', label: 'name' }
          }
        }
      },
      data: { authors: [{ id: 7, name: 'Jane Austen' }], mainAuthor: { id: 7 } }
    })
    await wrapper.find('.dito-clipboard .dito-button--copy').trigger('click')
    await flushPromises()
    await wrapper.find('.dito-clipboard .dito-button--paste').trigger('click')
    await flushPromises()
    // `paste()` receives the copied data, with temporary ids of related items:
    const [[{ clipboardItem }]] = paste.mock.calls
    expect(clipboardItem).toEqual({
      authors: [{ id: expect.stringMatching(/^@\d+$/), name: 'Jane Austen' }],
      mainAuthor: { id: clipboardItem.authors[0].id }
    })
    const [author] = data.authors
    expect(author).toEqual({
      id: expect.stringMatching(/^@\d+$/),
      name: 'Jane Austen'
    })
    expect(data.mainAuthor).toMatchObject({ id: author.id })
    expect(dataModel.isDirty).toBe(true)
  })

  it('reads the system clipboard in Chrome to enable pasting', async () => {
    appState.agent.chrome = true
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue(
      JSON.stringify({ title: 'Dune' })
    )
    const { pasteButton, findField } = await mountBookForm()
    await flushPromises()
    expect(pasteButton.attributes('disabled')).toBeUndefined()
    await pasteButton.trigger('click')
    await flushPromises()
    expect(findField('title').find('input').element.value).toBe('Dune')
  })

  it(`doesn't enable pasting data of other schemas`, async () => {
    const { pasteButton } = await mountBookForm()
    await copyClipboardData('author', { name: 'Jane' })
    await flushPromises()
    expect(pasteButton.attributes('disabled')).toBeDefined()
  })

  it('notifies malformed clipboard data when pasting', async () => {
    const { copyButton, pasteButton } = await mountBookForm()
    await copyButton.trigger('click')
    await flushPromises()
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('{ title')
    await pasteButton.trigger('click')
    await flushPromises()
    expect(alert).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain(
      'The data in the clipboard appears to be malformed'
    )
  })

  it('copies the items of nested forms without their ids', async () => {
    const { admin } = await mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            editable: true,
            itemLabel: 'title',
            form: {
              type: 'form',
              name: 'chapter',
              clipboard: true,
              components: {
                title: { type: 'text' },
                sections: {
                  type: 'list',
                  inlined: true,
                  form: {
                    type: 'form',
                    components: { name: { type: 'text' } }
                  }
                }
              }
            }
          }
        }
      },
      data: {
        chapters: [
          {
            id: 7,
            title: 'Prologue',
            sections: [
              { id: 5, name: 'Opening' },
              { id: 6, name: 'Ending' }
            ]
          }
        ]
      }
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    await admin.wrapper
      .find('.dito-clipboard .dito-button--copy')
      .trigger('click')
    await flushPromises()
    // Pasted items are new items, which mustn't carry the ids of others:
    expect(getClipboardData('chapter')).toEqual({
      title: 'Prologue',
      sections: [{ name: 'Opening' }, { name: 'Ending' }]
    })
  })

  it('keeps the position of the item that the data is pasted into', async () => {
    const { admin } = await mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            editable: true,
            orderKey: 'position',
            form: {
              type: 'form',
              clipboard: true,
              components: { title: { type: 'text' } }
            }
          }
        }
      },
      data: {
        chapters: [
          { id: 1, title: 'One', position: 0 },
          { id: 2, title: 'Two', position: 1 }
        ]
      }
    })
    const openChapter = async index => {
      await admin.navigate(`/items/1/chapters/${index}`)
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      return form
    }
    await openChapter(1)
    await admin.wrapper
      .find('.dito-clipboard .dito-button--copy')
      .trigger('click')
    await flushPromises()
    const form = await openChapter(0)
    await admin.wrapper
      .find('.dito-clipboard .dito-button--paste')
      .trigger('click')
    await flushPromises()
    expect(form.data).toMatchObject({ id: 1, title: 'Two', position: 0 })
  })

  it('notifies errors of `clipboard.copy()`', async () => {
    const { copyButton } = await mountBookForm({
      copy() {
        throw new Error('Copying failed')
      }
    })
    await copyButton.trigger('click')
    await flushPromises()
    expect(alert).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain('Copying failed')
  })

  it('notifies errors of `clipboard.paste()`', async () => {
    const { copyButton, pasteButton } = await mountBookForm({
      paste() {
        throw new Error('Pasting failed')
      }
    })
    await copyButton.trigger('click')
    await flushPromises()
    await pasteButton.trigger('click')
    await flushPromises()
    expect(alert).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain('Pasting failed')
  })

  describe('relations to records outside of the copy', () => {
    const records = {
      authors: [
        { id: 1, name: 'Jane Austen' },
        { id: 2, name: 'Mary Shelley' }
      ],
      genres: [
        { id: 10, name: 'Gothic' },
        { id: 11, name: 'Romance' }
      ]
    }

    const relateRecords = (url, options = {}) => ({
      type: 'select',
      relate: true,
      options: {
        data: ({ request }) => request({ url }),
        label: 'name'
      },
      ...options
    })

    // The genres are in a tab that isn't shown, so their options only load
    // when copying:
    async function mountBookForm({ data, request = null }) {
      const loadRecords = vi.fn(
        request ?? (({ url }) => ({ data: records[url] }))
      )
      const result = await mountForm({
        schema: {
          name: 'book',
          clipboard: true,
          tabs: {
            main: {
              type: 'tab',
              components: {
                title: { type: 'text' },
                author: relateRecords('authors'),
                chapters: {
                  type: 'list',
                  inlined: true,
                  form: {
                    type: 'form',
                    components: {
                      title: { type: 'text' },
                      narrator: relateRecords('authors')
                    }
                  }
                }
              }
            },
            more: {
              type: 'tab',
              components: {
                genres: relateRecords('genres', {
                  type: 'multiselect',
                  multiple: true
                })
              }
            }
          }
        },
        data,
        request: loadRecords
      })
      const { wrapper } = result
      return {
        ...result,
        loadRecords,
        async copy() {
          await wrapper
            .find('.dito-clipboard .dito-button--copy')
            .trigger('click')
          await flushPromises()
        },
        async paste() {
          await wrapper
            .find('.dito-clipboard .dito-button--paste')
            .trigger('click')
          await flushPromises()
        }
      }
    }

    const book = {
      title: 'Northanger Abbey',
      author: { id: 1 },
      chapters: [{ id: 5, title: 'One', narrator: { id: 2 } }],
      genres: [{ id: 10 }, { id: 11 }]
    }

    it('copies the labels of the related records instead of ids', async () => {
      const { copy, loadRecords } = await mountBookForm({ data: book })
      expect(loadRecords).not.toHaveBeenCalledWith(
        expect.objectContaining({ url: 'genres' })
      )
      await copy()
      expect(getClipboardData('book')).toEqual({
        title: 'Northanger Abbey',
        author: { $label: 'Jane Austen' },
        chapters: [{ title: 'One', narrator: { $label: 'Mary Shelley' } }],
        genres: [{ $label: 'Gothic' }, { $label: 'Romance' }]
      })
    })

    it('keeps the temporary ids of relations inside the copy', async () => {
      const { wrapper } = await mountForm({
        schema: {
          name: 'book',
          clipboard: true,
          components: {
            authors: {
              type: 'list',
              inlined: true,
              form: { type: 'form', components: { name: { type: 'text' } } }
            },
            mainAuthor: {
              type: 'select',
              relate: true,
              options: { dataPath: 'authors', label: 'name' }
            },
            publisher: {
              type: 'select',
              relate: true,
              options: {
                data: [{ id: 30, name: 'Hogarth Press' }],
                label: 'name'
              }
            }
          }
        },
        data: {
          authors: [{ id: 7, name: 'Jane Austen' }],
          mainAuthor: { id: 7 },
          publisher: { id: 30 }
        }
      })
      await wrapper.find('.dito-clipboard .dito-button--copy').trigger('click')
      await flushPromises()
      const clipboardData = getClipboardData('book')
      expect(clipboardData).toEqual({
        authors: [{ id: expect.stringMatching(/^@\d+$/), name: 'Jane Austen' }],
        mainAuthor: { id: clipboardData.authors[0].id },
        publisher: { $label: 'Hogarth Press' }
      })
    })

    it('resolves labels ignoring case and whitespace', async () => {
      // Another admin, with other ids for the same records:
      const { paste, data } = await mountBookForm({
        data: { title: '', author: null, chapters: [], genres: [] },
        request: ({ url }) => ({
          data: records[url].map(({ id, name }) => ({ id: id + 100, name }))
        })
      })
      await copyClipboardData('book', {
        title: 'Frankenstein',
        author: { $label: '  mary   SHELLEY ' },
        chapters: [{ title: 'One', narrator: { $label: 'jane austen' } }],
        genres: [{ $label: 'GOTHIC' }]
      })
      await paste()
      expect(data.author).toEqual({ id: 102, name: 'Mary Shelley' })
      expect(data.chapters[0].narrator).toEqual({
        id: 101,
        name: 'Jane Austen'
      })
      expect(data.genres).toEqual([{ id: 110, name: 'Gothic' }])
      expect(getNotificationTexts()).toEqual([])
    })

    it('pastes `null` for unmatched and ambiguous labels', async () => {
      const { paste, data } = await mountBookForm({
        data: book,
        request: ({ url }) => ({
          data: [...records[url], { id: 3, name: 'Mary Shelley' }]
        })
      })
      await copyClipboardData('book', {
        author: { $label: 'Mary Shelley' },
        chapters: [{ title: 'One', narrator: { $label: 'Ann Radcliffe' } }]
      })
      await paste()
      expect(data.author).toBe(null)
      expect(data.chapters[0].narrator).toBe(null)
      expect(getNotificationTexts().join()).toContain(
        `Not found when pasting: Author 'Mary Shelley', Narrator 'Ann Radcliffe'`
      )
    })

    it('keeps the matched records of multiple relations', async () => {
      const { paste, data } = await mountBookForm({ data: book })
      await copyClipboardData('book', {
        genres: [{ $label: 'Romance' }, { $label: 'Satire' }]
      })
      await paste()
      expect(data.genres).toEqual([{ id: 11, name: 'Romance' }])
      expect(getNotificationTexts().join()).toContain(
        `Not found when pasting: Genres 'Satire'`
      )
    })

    it('pastes copied relations back within the same admin', async () => {
      const { copy, paste, data, dataModel } = await mountBookForm({
        data: book
      })
      await copy()
      data.author = { id: 2 }
      data.genres = []
      await paste()
      expect(data.author).toMatchObject({ id: 1 })
      expect(data.chapters).toMatchObject([
        { title: 'One', narrator: { id: 2 } }
      ])
      expect(data.genres).toMatchObject([{ id: 10 }, { id: 11 }])
      expect(getNotificationTexts()).toEqual([])
      expect(dataModel.isDirty).toBe(true)
    })
  })
})
