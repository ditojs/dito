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

  it('gives the forms of objects their clipboard, not of lists', async () => {
    const form = { type: 'form', components: { title: { type: 'text' } } }
    const { findField, findContainer } = await mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            inlined: true,
            clipboard: true,
            components: { title: { type: 'text' } }
          },
          books: { type: 'list', inlined: true, clipboard: true, form },
          cover: { type: 'object', inlined: true, clipboard: true, form }
        }
      },
      data: {
        chapters: [{ id: 1, title: 'Prologue' }],
        books: [{ id: 2, title: 'Emma' }],
        cover: { title: 'Front' }
      }
    })
    for (const name of ['chapters', 'books']) {
      const container = findContainer(name)
      expect(container.findAll('.dito-clipboard')).toHaveLength(1)
      expect(container.findAll('.dito-label .dito-clipboard')).toHaveLength(1)
    }
    expect(findField('cover').findAll('.dito-clipboard')).toHaveLength(1)
  })

  describe('lists', () => {
    const relateAuthor = {
      type: 'select',
      relate: true,
      options: { dataPath: '/authors', label: 'name' }
    }

    const createBooks = settings => ({
      type: 'list',
      inlined: true,
      creatable: true,
      clipboard: true,
      orderKey: 'position',
      forms: {
        novel: {
          type: 'form',
          components: { title: { type: 'text' }, author: relateAuthor }
        },
        comic: { type: 'form', components: { artist: { type: 'text' } } }
      },
      ...settings
    })

    async function mountShelves({ books, shelf } = {}) {
      const result = await mountForm({
        schema: {
          components: {
            authors: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                components: { name: { type: 'text' } }
              }
            },
            books: createBooks(books),
            // A list of the same name elsewhere, and one of another name:
            shelf: {
              type: 'section',
              nested: true,
              components: { books: createBooks(shelf) }
            },
            magazines: createBooks()
          }
        },
        data: {
          authors: [
            { id: 1, name: 'Jane Austen' },
            { id: 2, name: 'Mary Shelley' }
          ],
          books: [
            {
              id: 5,
              type: 'novel',
              title: 'Emma',
              author: { id: 1 },
              position: 0
            },
            { id: 6, type: 'comic', artist: 'Hergé', position: 1 }
          ],
          shelf: {
            books: [{ id: 9, type: 'comic', artist: 'Moebius', position: 0 }]
          },
          magazines: []
        }
      })
      const { findContainer } = result
      const findButton = (dataPath, button) =>
        findContainer(dataPath).find(`.dito-label .dito-button--${button}`)
      return {
        ...result,
        findButton,
        async click(dataPath, button) {
          await findButton(dataPath, button).trigger('click')
          await flushPromises()
        }
      }
    }

    it('copies the items and pastes them into lists of the same name', async () => {
      const { click, data, dataModel } = await mountShelves()
      await click('books', 'copy')
      expect(getClipboardData('books', 'list')).toEqual({
        items: [
          {
            type: 'novel',
            title: 'Emma',
            author: { $label: 'Jane Austen' },
            position: 0
          },
          { type: 'comic', artist: 'Hergé', position: 1 }
        ]
      })
      await click('shelf/books', 'paste')
      // Each item is created with the form of its type:
      expect(data.shelf.books).toEqual([
        { id: 9, type: 'comic', artist: 'Moebius', position: 0 },
        {
          type: 'novel',
          title: 'Emma',
          author: { id: 1, name: 'Jane Austen' },
          position: 1
        },
        { type: 'comic', artist: 'Hergé', position: 2 }
      ])
      expect(getNotificationTexts()).toEqual([])
      expect(dataModel.isDirty).toBe(true)
    })

    it('leaves out the items without a creatable form', async () => {
      const { click, data } = await mountShelves({
        shelf: {
          forms: {
            comic: {
              type: 'form',
              components: { artist: { type: 'text' } }
            },
            novel: {
              type: 'form',
              creatable: false,
              components: { title: { type: 'text' } }
            }
          }
        }
      })
      await click('books', 'copy')
      await click('shelf/books', 'paste')
      expect(data.shelf.books).toEqual([
        { id: 9, type: 'comic', artist: 'Moebius', position: 0 },
        { type: 'comic', artist: 'Hergé', position: 1 }
      ])
    })

    it(`doesn't paste into lists that aren't creatable`, async () => {
      const { click, findButton } = await mountShelves({
        shelf: { creatable: false }
      })
      await click('books', 'copy')
      expect(
        findButton('books', 'paste').attributes('disabled')
      ).toBeUndefined()
      expect(
        findButton('shelf/books', 'paste').attributes('disabled')
      ).toBeDefined()
    })

    it(`doesn't paste into lists of another name`, async () => {
      const { click, findButton } = await mountShelves()
      await click('books', 'copy')
      expect(
        findButton('shelf/books', 'paste').attributes('disabled')
      ).toBeUndefined()
      expect(
        findButton('magazines', 'paste').attributes('disabled')
      ).toBeDefined()
    })

    it(`doesn't paste lists into forms and uploads, or back`, async () => {
      const { wrapper, findContainer } = await mountForm({
        schema: {
          name: 'book',
          clipboard: true,
          components: {
            chapters: {
              type: 'list',
              inlined: true,
              creatable: true,
              clipboard: true,
              components: { title: { type: 'text' } }
            },
            files: { type: 'upload', multiple: true, clipboard: true }
          }
        },
        data: {
          chapters: [{ id: 1, title: 'Prologue' }],
          files: [{ name: 'a.png', size: 1, type: 'image/png', key: 'a.png' }]
        }
      })
      const buttons = {
        book: '.dito-schema-header .dito-clipboard',
        chapters: '.dito-label .dito-clipboard',
        files: 'tfoot .dito-clipboard'
      }
      const findButton = (name, button) => {
        const parent = name === 'book' ? wrapper : findContainer(name)
        return parent.find(`${buttons[name]} .dito-button--${button}`)
      }
      const getPastable = () =>
        Object.keys(buttons).filter(
          name => findButton(name, 'paste').attributes('disabled') === undefined
        )
      for (const name of Object.keys(buttons)) {
        await findButton(name, 'copy').trigger('click')
        await flushPromises()
        expect(getPastable()).toEqual([name])
      }
    })

    describe('of primitives, with `wrapPrimitives`', () => {
      async function mountFonts(fonts) {
        const result = await mountForm({
          schema: {
            components: {
              fonts: {
                type: 'list',
                inlined: true,
                form: {
                  type: 'form',
                  components: {
                    cuts: {
                      type: 'list',
                      wrapPrimitives: 'name',
                      inlined: true,
                      clipboard: true,
                      creatable: true,
                      draggable: true,
                      deletable: ({ value }) => value.length > 1,
                      // Lists always show at least one empty cut:
                      computeValue: ({ value }) =>
                        value.length > 0 ? value : [''],
                      form: {
                        type: 'form',
                        compact: true,
                        components: { name: { type: 'text' } }
                      }
                    }
                  }
                }
              }
            }
          },
          data: { fonts }
        })
        const findButton = (dataPath, button) =>
          result
            .findContainer(dataPath)
            .find(`.dito-label .dito-button--${button}`)
        return {
          ...result,
          async click(dataPath, button) {
            await findButton(dataPath, button).trigger('click')
            await flushPromises()
          }
        }
      }

      it('copies the values and pastes them as values', async () => {
        const { click, data, dataModel, findField } = await mountFonts([
          { id: 1, cuts: ['Regular', 'Bold'] },
          { id: 2, cuts: ['Light'] }
        ])
        await click('fonts/0/cuts', 'copy')
        expect(getClipboardData('cuts', 'list')).toEqual({
          items: [{ name: 'Regular' }, { name: 'Bold' }]
        })
        await click('fonts/1/cuts', 'paste')
        expect(data.fonts[1].cuts).toEqual(['Light', 'Regular', 'Bold'])
        expect(
          findField('fonts/1/cuts')
            .findAll('input')
            .map(input => input.element.value)
        ).toEqual(['Light', 'Regular', 'Bold'])
        expect(getNotificationTexts()).toEqual([])
        expect(dataModel.isDirty).toBe(true)
      })

      // Empty text serializes to `null`, as when the form is submitted:
      it('copies and pastes the empty value of empty lists', async () => {
        const { click, data } = await mountFonts([
          { id: 1, cuts: [] },
          { id: 2, cuts: ['Light'] }
        ])
        expect(data.fonts[0].cuts).toEqual([''])
        await click('fonts/0/cuts', 'copy')
        expect(getClipboardData('cuts', 'list')).toEqual({
          items: [{ name: null }]
        })
        await click('fonts/1/cuts', 'paste')
        expect(data.fonts[1].cuts).toEqual(['Light', null])
        await click('fonts/1/cuts', 'copy')
        await click('fonts/0/cuts', 'paste')
        expect(data.fonts[0].cuts).toEqual(['', 'Light', null])
      })
    })

    it('gives lists with their own resource no clipboard', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { findField } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              resource: { path: 'chapters' },
              clipboard: true,
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { title: 'Emma' },
        request: () => ({ data: [{ id: 1, title: 'Prologue' }] })
      })
      expect(findField('chapters').find('.dito-clipboard').exists()).toBe(false)
      expect(warn).toHaveBeenCalledWith(
        `Unsupported 'clipboard' in lists with 'resource': 'chapters'.`
      )
    })
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
