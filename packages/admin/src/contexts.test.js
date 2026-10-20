import { vi } from 'vitest'
import { toRaw } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import {
  mountSchema,
  mountForm,
  mountAdmin,
  settle,
  isForm,
  enterValue
} from './test/mount.js'
import { toModelData } from './utils/data.js'

// The contexts that the callbacks of each kind of component receive, by key:
let contexts
const record = key => context => {
  contexts[key] = context
}
const recordLabel = key => context => {
  record(key)(context)
  return key
}
const recordIf = key => context => {
  record(key)(context)
  return true
}

beforeEach(() => {
  contexts = {}
})

// Describe the items of the context by the names of `items`, and its paths:
function describeContext(context, items) {
  const getName = value => {
    if (value == null) return null
    const raw = toRaw(toModelData(value))
    const entry = Object.entries(items).find(([, item]) => toRaw(item) === raw)
    return entry?.[0] ?? 'unknown'
  }
  return {
    item: getName(context.item),
    itemDataPath: context.itemDataPath,
    itemIndex: context.itemIndex,
    parentItem: getName(context.parentItem),
    parentItemDataPath: context.parentItemDataPath,
    rootItem: getName(context.rootItem),
    nested: context.nested
  }
}

function describeContexts(keys, items) {
  return Object.fromEntries(
    keys.map(key => [key, describeContext(contexts[key], items)])
  )
}

// The context of a value in the root item, and of the item itself:
const inRoot = { itemDataPath: '', itemIndex: null, parentItem: null }
const ofRoot = { ...inRoot, nested: false }
const atRoot = { parentItemDataPath: null, rootItem: 'root' }

// The context of a value in an item of a list in the root item, or of it:
const inItem = (item, itemDataPath, itemIndex = null) => ({
  item,
  itemDataPath,
  itemIndex,
  parentItem: 'root',
  parentItemDataPath: '',
  rootItem: 'root'
})

describe('the contexts of components', () => {
  it('describe the item that holds the value, or the item itself', async () => {
    const { data } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text', label: recordLabel('field') },
          go: { type: 'button', label: recordLabel('button') },
          chapters: {
            type: 'list',
            inlined: true,
            buttons: {
              add: {
                type: 'button',
                if: recordIf('listButtonIf'),
                label: recordLabel('listButton')
              }
            },
            form: {
              type: 'form',
              onInitialize: record('inlinedFormEvent'),
              fields: {
                heading: { type: 'text', label: recordLabel('fieldInItem') },
                notes: {
                  type: 'list',
                  inlined: true,
                  buttons: {
                    add: {
                      type: 'button',
                      label: recordLabel('nestedListButton')
                    }
                  },
                  form: {
                    type: 'form',
                    fields: { text: { type: 'text' } }
                  }
                }
              }
            }
          },
          details: {
            type: 'section',
            onInitialize: record('sectionEvent'),
            fields: { subtitle: { type: 'text' } }
          },
          meta: {
            type: 'section',
            nested: true,
            onInitialize: record('nestedSectionEvent'),
            fields: {
              year: { type: 'text', label: recordLabel('fieldInSection') }
            }
          },
          author: {
            type: 'object',
            inlined: true,
            form: {
              type: 'form',
              onInitialize: record('objectFormEvent'),
              fields: { name: { type: 'text' } }
            },
            buttons: {
              check: { type: 'button', label: recordLabel('objectButton') }
            }
          },
          notes: {
            type: 'list',
            deletable: true,
            columns: {
              text: { render: context => recordLabel('cell')(context) }
            },
            form: {
              type: 'form',
              deletable: recordIf('cellEditButtons'),
              fields: { text: { type: 'text' } }
            }
          },
          refs: {
            type: 'list',
            render: context => recordLabel('listRender')(context),
            form: { type: 'form', fields: { title: { type: 'text' } } }
          },
          tags: {
            type: 'list',
            inlined: true,
            wrapPrimitives: 'value',
            form: {
              type: 'form',
              fields: {
                value: { type: 'text', label: recordLabel('wrappedValue') }
              }
            }
          }
        }
      },
      data: {
        title: 'Emma',
        chapters: [{ heading: 'One', notes: [] }, { heading: 'Two' }],
        meta: { year: '1815' },
        author: { name: 'Jane' },
        notes: [{ text: 'Note' }],
        refs: [{ title: 'Ref' }],
        tags: ['classic']
      }
    })
    const [chapter0, chapter1] = data.chapters
    const items = {
      root: data,
      chapter0,
      chapter1,
      meta: data.meta,
      author: data.author,
      note0: data.notes[0],
      ref0: data.refs[0]
    }
    expect(
      describeContexts(
        [
          'field',
          'button',
          'listButtonIf',
          'listButton',
          'inlinedFormEvent',
          'fieldInItem',
          'nestedListButton',
          'sectionEvent',
          'nestedSectionEvent',
          'fieldInSection',
          'objectFormEvent',
          'objectButton',
          'cell',
          'cellEditButtons',
          'listRender',
          'wrappedValue'
        ],
        items
      )
    ).toEqual({
      field: { item: 'root', ...inRoot, ...atRoot, nested: true },
      button: { item: 'root', ...inRoot, ...atRoot, nested: true },
      listButtonIf: { item: 'root', ...inRoot, ...atRoot, nested: true },
      listButton: { item: 'root', ...inRoot, ...atRoot, nested: true },
      // Of the last inlined item:
      inlinedFormEvent: {
        ...inItem('chapter1', 'chapters/1', 1),
        nested: false
      },
      fieldInItem: { ...inItem('chapter1', 'chapters/1', 1), nested: true },
      nestedListButton: {
        ...inItem('chapter1', 'chapters/1', 1),
        nested: true
      },
      sectionEvent: { item: 'root', ...ofRoot, ...atRoot },
      nestedSectionEvent: { ...inItem('meta', 'meta'), nested: false },
      fieldInSection: { ...inItem('meta', 'meta'), nested: true },
      objectFormEvent: { ...inItem('author', 'author'), nested: false },
      objectButton: { ...inItem('author', 'author'), nested: false },
      cell: { ...inItem('note0', 'notes/0', 0), nested: true },
      cellEditButtons: { ...inItem('note0', 'notes/0', 0), nested: false },
      listRender: { ...inItem('ref0', 'refs/0', 0), nested: false },
      // The wrapper of the primitive isn't in the root data:
      wrappedValue: { ...inItem('unknown', 'tags/0', 0), nested: true }
    })
    expect(contexts.wrappedValue.item).toEqual({ value: 'classic' })
    // Events of schemas describe their item, not a value:
    expect(contexts.sectionEvent.value).toBe(undefined)
    expect(contexts.nestedSectionEvent.value).toBe(undefined)
    expect(contexts.objectFormEvent.value).toBe(undefined)
  })

  it('evaluate `if` with the same contexts in validation', async () => {
    const isRendered = vi.fn(() => true)
    const { data, routeComponent } = await mountSchema({
      schema: {
        fields: {
          address: {
            type: 'object',
            inlined: true,
            form: {
              type: 'form',
              fields: {
                details: {
                  type: 'section',
                  if: isRendered,
                  fields: { zip: { type: 'text' } }
                }
              }
            }
          }
        }
      },
      data: { address: { zip: '8000' } }
    })
    const callCount = isRendered.mock.calls.length
    routeComponent.dataContext.validate()
    expect(isRendered.mock.calls.length).toBeGreaterThan(callCount)
    // All calls, while rendering and validating, describe the same item:
    const items = { root: data, address: data.address }
    const descriptions = isRendered.mock.calls.map(([context]) =>
      describeContext(context, items)
    )
    expect(new Set(descriptions.map(it => JSON.stringify(it))).size).toBe(1)
    expect(descriptions[0]).toEqual({
      ...inItem('address', 'address'),
      nested: false
    })
  })

  it('describe the item of nested sections when they toggle', async () => {
    const { data, findContainer } = await mountSchema({
      schema: {
        fields: {
          meta: {
            type: 'section',
            nested: true,
            label: 'Meta',
            collapsible: true,
            onToggle: record('toggle'),
            fields: { year: { type: 'text' } }
          }
        }
      },
      data: { meta: { year: '1815' } }
    })
    await findContainer('meta')
      .find('.dito-schema-header .dito-label')
      .trigger('click')
    await flushPromises()
    const items = { root: data, meta: data.meta }
    expect(describeContext(contexts.toggle, items)).toEqual({
      ...inItem('meta', 'meta'),
      nested: false
    })
    expect(contexts.toggle.value).toBe(undefined)
    expect(contexts.toggle.collapsed).toBe(true)
  })

  it('describe created items in their place in the data', async () => {
    const getDefault = vi.fn(() => 'New')
    const getComponents = vi.fn(() => ({
      heading: { type: 'text', default: getDefault }
    }))
    const { data, getComponent, settle } = await mountSchema({
      schema: {
        fields: {
          chapters: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              fields: {
                details: { type: 'section', fields: getComponents }
              }
            }
          }
        }
      },
      data: { chapters: [] }
    })
    const chapters = getComponent('chapters')
    chapters.sourceContext.createItem(chapters.schema.form)
    await settle()
    // All calls, while creating and rendering the item, describe it:
    const items = { root: data, chapter: data.chapters[0] }
    const describeCalls = fn =>
      new Set(
        fn.mock.calls.map(([context]) =>
          JSON.stringify(describeContext(context, items))
        )
      )
    const inChapter = inItem('chapter', 'chapters/0', 0)
    expect(describeCalls(getComponents)).toEqual(
      new Set([JSON.stringify({ ...inChapter, nested: false })])
    )
    expect(describeCalls(getDefault)).toEqual(
      new Set([JSON.stringify({ ...inChapter, nested: true })])
    )
    expect(data.chapters).toEqual([{ heading: 'New' }])
  })

  it('describe the wrappers of primitives in the data model', async () => {
    const isRendered = vi.fn(() => true)
    const computeValue = vi.fn(() => undefined)
    await mountSchema({
      schema: {
        fields: {
          tags: {
            type: 'list',
            inlined: true,
            wrapPrimitives: 'value',
            form: {
              type: 'form',
              fields: {
                value: { type: 'text', if: isRendered, computeValue }
              }
            }
          }
        }
      },
      data: { tags: ['classic', 'novel'] }
    })
    // All calls, while rendering and in the data model, describe the wrapper:
    const describeCalls = fn =>
      new Set(
        fn.mock.calls.map(([{ itemDataPath, itemIndex }]) =>
          JSON.stringify({ itemDataPath, itemIndex })
        )
      )
    const wrappers = new Set([
      JSON.stringify({ itemDataPath: 'tags/0', itemIndex: 0 }),
      JSON.stringify({ itemDataPath: 'tags/1', itemIndex: 1 })
    ])
    expect(describeCalls(isRendered)).toEqual(wrappers)
    expect(describeCalls(computeValue)).toEqual(wrappers)
  })

  describe('in routed forms', () => {
    async function mountBook() {
      return mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              form: {
                type: 'form',
                onInitialize: record('formEvent'),
                onChange: record('formChange'),
                fields: {
                  heading: { type: 'text' },
                  check: { type: 'button', onClick: record('buttonClick') }
                },
                buttons: {
                  extra: {
                    type: 'button',
                    if: recordIf('formButtonIf'),
                    label: recordLabel('formButton')
                  }
                }
              }
            },
            meta: {
              type: 'object',
              editable: true,
              form: {
                type: 'form',
                onInitialize: record('objectFormEvent'),
                fields: { year: { type: 'text' } }
              }
            }
          }
        },
        data: {
          id: 1,
          title: 'Emma',
          chapters: [
            { id: 5, heading: 'One' },
            { id: 6, heading: 'Two' }
          ],
          meta: { year: '1815' }
        },
        request: ({ data }) => ({ data })
      })
    }

    it('describe the draft of the item, in the root data', async () => {
      const { admin, data } = await mountBook()
      await admin.navigate('/items/1/chapters/1')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input'), 'Second')
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      const items = { root: data, draft: form.data }
      const inDraft = inItem('draft', 'chapters/1', 1)
      expect(
        describeContexts(
          ['formEvent', 'formChange', 'formButtonIf', 'formButton'],
          items
        )
      ).toEqual({
        formEvent: { ...inDraft, nested: false },
        // The change of the applied item:
        formChange: { ...inDraft, nested: false },
        formButtonIf: { ...inDraft, nested: true },
        formButton: { ...inDraft, nested: true }
      })
      expect(contexts.formEvent.value).toBe(undefined)
    })

    it('describe the item of object forms', async () => {
      const { admin, data } = await mountBook()
      await admin.navigate('/items/1/meta')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(
        describeContext(contexts.objectFormEvent, {
          root: data,
          draft: form.data
        })
      ).toEqual({ ...inItem('draft', 'meta'), nested: false })
    })

    it('keep the root of the draft of reused forms current', async () => {
      const { admin } = await mountBook()
      const clickCheck = async () => {
        const form = admin.getRouteComponent(isForm)
        await settle(form)
        await new DOMWrapper(form.$el)
          .find('button[id$="check"]')
          .trigger('click')
        return form
      }
      await admin.navigate('/items/1/chapters/0')
      const form = await clickCheck()
      await admin.navigate('/items/1/chapters/1')
      expect(await clickCheck()).toBe(form)
      const { item, rootItem } = contexts.buttonClick
      expect(item.heading).toBe('Two')
      expect(rootItem.chapters[1]).toBe(item)
    })
  })

  it('give submit events the context of the click', async () => {
    const { findField, data } = await mountForm({
      schema: {
        fields: {
          chapters: {
            type: 'list',
            resource: { path: 'chapters' },
            columns: { title: {} },
            buttons: {
              order: {
                type: 'submit',
                resource: { path: 'order', method: 'post' },
                onClick: context => {
                  record('click')(context)
                  return context.submit()
                },
                onSuccess: record('success')
              },
              publish: {
                type: 'submit',
                resource: { path: 'publish', method: 'post' },
                onClick: context => context.submit(),
                onError: context => {
                  record('error')(context)
                  return false
                }
              }
            }
          }
        }
      },
      data: { id: 1, title: 'Emma' },
      request: ({ method = 'get', url }) => {
        if (url.endsWith('/publish')) {
          throw Object.assign(new Error('Unable to publish'), {
            response: { status: 500, data: { message: 'Unable to publish' } }
          })
        }
        return method === 'get' && url === '/items/1/chapters'
          ? { data: [{ id: 1, title: 'One' }] }
          : { data: { id: 1, title: 'Emma' } }
      }
    })
    const buttons = findField('chapters').findAll('.dito-buttons button')
    for (const button of buttons) {
      await button.trigger('click')
      await flushPromises()
    }
    const items = { root: data }
    const clicked = { item: 'root', ...inRoot, ...atRoot, nested: true }
    expect(describeContexts(['click', 'success', 'error'], items)).toEqual({
      click: clicked,
      success: clicked,
      error: clicked
    })
    expect(contexts.success.dataPath).toBe('chapters/order')
    expect(contexts.error.error).toBeTruthy()
  })

  it('give submit events of single-component views the click context', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          field: {
            type: 'list',
            resource: { path: 'books' },
            columns: { title: {} },
            buttons: {
              order: {
                type: 'submit',
                resource: { path: 'order', method: 'post' },
                onClick: context => {
                  record('click')(context)
                  return context.submit()
                },
                onSuccess: record('success')
              }
            },
            form: { type: 'form', fields: { title: { type: 'text' } } }
          }
        }
      },
      request: ({ method = 'get' }) => ({
        data: method === 'get' ? [{ id: 1, title: 'Emma' }] : {}
      })
    })
    await admin.navigate('/books')
    const view = admin.getRouteComponent()
    await settle(view)
    await new DOMWrapper(document.body)
      .find('button[id$="order"]')
      .trigger('click')
    await flushPromises()
    const items = { books: view.data.books }
    const clicked = describeContext(contexts.click, items)
    expect(clicked.item).toBe('books')
    expect(describeContext(contexts.success, items)).toEqual(clicked)
  })

  describe('in panels', () => {
    it('describe the data that the panels display', async () => {
      const { data, routeComponent } = await mountSchema({
        schema: {
          fields: {
            title: { type: 'text' },
            info: {
              type: 'panel',
              nested: true,
              fields: {
                note: { type: 'text', label: recordLabel('nestedPanelField') }
              }
            }
          },
          panels: {
            side: {
              type: 'panel',
              fields: {
                summary: { type: 'text', label: recordLabel('panelField') }
              },
              buttons: {
                refresh: { type: 'button', label: recordLabel('panelButton') }
              }
            },
            details: {
              type: 'panel',
              nested: true,
              fields: {
                color: { type: 'text', label: recordLabel('nestedPanelValue') }
              }
            },
            search: {
              type: 'panel',
              data: { query: 'Persuasion' },
              onInitialize: record('ownPanelEvent'),
              fields: {
                query: { type: 'text', label: recordLabel('ownPanelField') }
              }
            }
          }
        },
        data: {
          title: 'Emma',
          color: 'blue',
          details: { color: 'red' },
          info: { note: 'Info' }
        }
      })
      const items = {
        root: data,
        details: data.details,
        info: data.info,
        search: contexts.ownPanelField.item
      }
      expect(
        describeContexts(
          [
            'panelField',
            'panelButton',
            'nestedPanelValue',
            'nestedPanelField',
            'ownPanelEvent',
            'ownPanelField'
          ],
          items
        )
      ).toEqual({
        panelField: { item: 'root', ...inRoot, ...atRoot, nested: true },
        panelButton: { item: 'root', ...inRoot, ...atRoot, nested: true },
        nestedPanelValue: { ...inItem('details', 'details'), nested: true },
        nestedPanelField: { ...inItem('info', 'info'), nested: true },
        ownPanelEvent: { ...inItem('search', 'search'), nested: false },
        ownPanelField: { ...inItem('search', 'search'), nested: true }
      })
      expect(contexts.ownPanelField.item).toEqual({ query: 'Persuasion' })
      // Nested panels edit the values under their name:
      const sidebar = new DOMWrapper(document.body)
      const input = sidebar.find('.dito-panel input[name="details/color"]')
      expect(input.element.value).toBe('red')
      await enterValue(input, 'green')
      expect(data).toMatchObject({ color: 'blue', details: { color: 'green' } })
      expect(routeComponent.dataContext.model.serializedData.value).toEqual({
        title: 'Emma',
        summary: '',
        details: { color: 'green' },
        info: { note: 'Info' }
      })
    })

    it('edit the data around panels with their own data', async () => {
      const { data, routeComponent } = await mountSchema({
        schema: {
          fields: { title: { type: 'text' } },
          panels: {
            search: {
              type: 'panel',
              data: { query: 'Persuasion' },
              fields: {
                query: { type: 'text', label: recordLabel('ownPanelField') }
              }
            }
          },
          buttons: { submit: { type: 'submit' } }
        },
        data: { title: 'Emma' }
      })
      const { rootItem, parentItem } = contexts.ownPanelField
      expect(routeComponent.dataContext.isDirty).toBe(false)
      rootItem.title = 'Persuasion'
      expect(data.title).toBe('Persuasion')
      expect(routeComponent.dataContext.isDirty).toBe(true)
      expect(parentItem).toBe(rootItem)
    })

    it('evaluate the fields of panels with their own data in it', async () => {
      const error = vi.spyOn(console, 'error')
      const contextsOfIf = []
      const createPanel = query => ({
        type: 'panel',
        data: { query },
        fields: {
          query: {
            type: 'text',
            if: context => {
              contextsOfIf.push(context)
              return !!context.item.query
            }
          }
        }
      })
      const { routeComponent } = await mountSchema({
        schema: {
          fields: {
            title: { type: 'text' },
            filter: createPanel('Emma')
          },
          panels: { search: createPanel('Persuasion') }
        },
        data: { title: 'Emma' }
      })
      routeComponent.dataContext.validate()
      expect(error).not.toHaveBeenCalled()
      error.mockRestore()
      // All calls, also the first while the panel's data is set up, and in the
      // validation of the page's data, describe the panel's data:
      const describeCall = ({ item, dataPath, itemDataPath, itemIndex }) =>
        JSON.stringify({ item, dataPath, itemDataPath, itemIndex })
      expect(new Set(contextsOfIf.map(describeCall))).toEqual(
        new Set([
          describeCall({
            item: { query: 'Emma' },
            dataPath: 'filter/query',
            itemDataPath: 'filter',
            itemIndex: null
          }),
          describeCall({
            item: { query: 'Persuasion' },
            dataPath: 'search/query',
            itemDataPath: 'search',
            itemIndex: null
          })
        ])
      )
    })

    it('describe the item that holds the list of filters', async () => {
      const admin = await mountAdmin({
        views: {
          test: {
            type: 'view',
            fields: {
              chapters: {
                type: 'list',
                inlined: true,
                form: {
                  type: 'form',
                  fields: {
                    notes: {
                      type: 'list',
                      resource: { path: 'notes' },
                      filters: {
                        text: { filter: 'text', label: recordLabel('filter') }
                      },
                      form: {
                        type: 'form',
                        fields: { text: { type: 'text' } }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        request: () => ({ data: [] })
      })
      await admin.navigate('/test')
      const view = admin.getRouteComponent()
      view.dataContext.resetItem({ chapters: [{ id: 1 }] })
      await settle(view)
      const { data } = view
      const items = {
        root: data,
        chapter0: data.chapters[0],
        filters: contexts.filter.item
      }
      expect(describeContext(contexts.filter, items)).toEqual({
        item: 'filters',
        itemDataPath: 'chapters/0/$filters',
        itemIndex: null,
        parentItem: 'chapter0',
        parentItemDataPath: 'chapters/0',
        rootItem: 'root',
        nested: true
      })
    })
  })

  it('describe the data of dialogs', async () => {
    const admin = await mountAdmin({
      views: { test: { type: 'view', fields: { title: { type: 'text' } } } }
    })
    await admin.navigate('/test')
    admin.context.showDialog({
      fields: {
        name: { type: 'text', label: recordLabel('dialogField') }
      },
      buttons: { ok: { type: 'submit', label: recordLabel('dialogButton') } },
      data: { name: 'Emma' }
    })
    await flushPromises()
    const items = { root: contexts.dialogField.rootItem }
    expect(describeContexts(['dialogField', 'dialogButton'], items)).toEqual({
      dialogField: { item: 'root', ...inRoot, ...atRoot, nested: true },
      dialogButton: { item: 'root', ...inRoot, ...atRoot, nested: true }
    })
  })
})
