import { vi } from 'vitest'
import { flushPromises, DOMWrapper } from '@vue/test-utils'
import { h, toRaw } from 'vue'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  enterValue,
  stubConfirm,
  isView,
  isForm
} from '../test/mount.js'
import { DitoSchemaField, useDitoContext } from '../index.js'
import DitoButtonType from '../types/DitoButtonType.vue'

const maliciousName = '<img src="x" onerror="alert(1)">'
const escapedName = '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'

async function mountBookForm(request) {
  const result = await mountForm({
    schema: {
      label: 'Book',
      fields: { name: { type: 'text' } }
    },
    data: { name: maliciousName },
    request
  })
  // The form notifies through the admin context:
  const notify = vi.spyOn(result.admin.context, 'notify')
  return { ...result, notify }
}

describe('DitoForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('labels the form with the text of its item label', async () => {
    const { wrapper } = await mountForm({
      schema: {
        label: 'Show',
        fields: { name: { type: 'text' } }
      },
      data: { name: 'Tom & Jerry' }
    })
    expect(wrapper.find('form.dito-scroll-parent').attributes('aria-label'))
      .toBe(`Show 'Tom & Jerry'`)
  })

  it('keeps its fields and buttons enabled while it saves', async () => {
    let finishSubmit
    const request = vi.fn(
      ({ data }) =>
        new Promise(resolve => {
          finishSubmit = () => resolve({ data })
        })
    )
    const { wrapper, findField } = await mountForm({
      schema: {
        fields: {
          title: { type: 'text' },
          preview: { type: 'button', text: 'Preview' }
        },
        buttons: { submit: { closeForm: false } }
      },
      data: { title: 'Dune' },
      request
    })
    await findField('submit').trigger('click')
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    expect(
      wrapper
        .findAll(':is(input, button[id$="preview"], button[id$="submit"])')
        .map(({ element }) => [element.name || element.id, element.disabled])
    ).toEqual([
      ['title', false],
      ['preview', false],
      ['$buttons/submit', false]
    ])
    finishSubmit()
    await flushPromises()
  })

  describe('submit()', () => {
    it('notifies the success with the escaped item label', async () => {
      const { submit, notify } = await mountBookForm(({ data }) => ({ data }))
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          html: `Book '${escapedName}' was saved.`
        })
      )
    })

    it('renders the item label in the notification', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const { submit } = await mountBookForm(({ data }) => ({ data }))
      await submit()
      await flushPromises()
      const notification = document.querySelector('.dito-notification')
      expect(notification.querySelector('img')).toBe(null)
      expect(notification.querySelector('p').textContent).toBe(
        `Book '${maliciousName}' was saved.`
      )
    })

    it('notifies errors with the escaped item label and message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { submit, notify } = await mountBookForm(() => {
        throw new Error('<b>Invalid</b>')
      })
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          html: [
            `Unable to save Book '${escapedName}':`,
            '&lt;b&gt;Invalid&lt;/b&gt;'
          ]
        })
      )
    })
  })

  describe('cancel button', () => {
    it('closes the form and returns to the list', async () => {
      const { admin, wrapper, request } = await mountForm({
        schema: { label: 'Book', fields: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      await wrapper
        .find('.dito-buttons--main button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(admin.getRouteComponent(isForm)).toBe(
        null
      )
      // Cancelling doesn't send anything:
      expect(
        request.mock.calls.filter(([{ method = 'get' }]) => method !== 'get')
      ).toEqual([])
    })

    it('leaves single-component views of objects for the root', async () => {
      const admin = await mountAdmin({
        views: {
          books: { type: 'view', label: 'Books', fields: {} },
          settings: {
            type: 'view',
            label: 'Settings',
            field: {
              type: 'object',
              resource: { path: 'settings' },
              form: { type: 'form', fields: { name: { type: 'text' } } }
            }
          }
        },
        request: () => ({ data: {} })
      })
      await admin.navigate('/settings')
      await admin.wrapper
        .find('.dito-buttons--main button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/')
      expect(admin.getRouteComponent(isForm)).toBe(null)
    })

    it('calls `onCancel()` once the form is closed', async () => {
      const onCancel = vi.fn()
      const { admin, wrapper } = await mountForm({
        schema: { fields: { title: { type: 'text' } }, onCancel },
        data: { title: 'Emma' }
      })
      await wrapper
        .find('.dito-buttons--main button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('passes the item label to `onCancel()`', async () => {
      const labels = []
      const { wrapper } = await mountForm({
        schema: {
          label: 'Book',
          fields: { name: { type: 'text' } },
          onCancel({ itemLabel }) {
            labels.push(itemLabel)
          }
        },
        data: { name: 'Emma' }
      })
      await wrapper
        .find('.dito-buttons--main button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(labels).toEqual([`Book 'Emma'`])
    })
  })

  describe('item label', () => {
    it('is the text of the label of the item', async () => {
      const labels = []
      await mountForm({
        schema: {
          label: 'Book',
          fields: { name: { type: 'text' } },
          onLoad({ itemLabel }) {
            labels.push(itemLabel)
          }
        },
        data: { name: 'Tom & <b>Jerry</b>' }
      })
      expect(labels).toEqual([`Book 'Tom & <b>Jerry</b>'`])
    })

    it('is read by the callbacks of components when they run', async () => {
      const labels = []
      const { wrapper, settle } = await mountForm({
        schema: {
          label: 'Book',
          fields: {
            name: { type: 'text' },
            note: {
              type: 'text',
              label: ({ itemLabel }) => {
                labels.push(itemLabel)
                return 'Note'
              }
            }
          }
        },
        data: { name: 'Emma' }
      })
      expect(labels.at(-1)).toBe(`Book 'Emma'`)
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await settle()
      expect(labels.at(-1)).toBe(`Book 'Persuasion'`)
    })

    it('is `null` in `itemLabel()` of the item', async () => {
      const itemLabels = []
      const { admin } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: ({ item, itemLabel }) => {
                itemLabels.push(itemLabel)
                return item.title
              },
              form: {
                type: 'form',
                fields: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Opening' }] }
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.dataContext.data.title).toBe('Opening')
      expect(itemLabels.length).toBeGreaterThan(0)
      expect(itemLabels.every(itemLabel => itemLabel === null)).toBe(true)
    })
  })

  describe('layout component', () => {
    const mountLayoutForm = component =>
      mountForm({
        schema: {
          label: 'Book',
          component,
          fields: { title: { type: 'text' } }
        },
        data: { title: 'Emma', notes: 'Not shown' },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })

    it('lays out the components of the form', async () => {
      const { wrapper, submit } = await mountLayoutForm({
        props: ['schema', 'context'],
        render: () =>
          h('div', { class: 'layout' }, h(DitoSchemaField, { name: 'title' }))
      })
      const input = wrapper.find('.layout input[name="title"]')
      expect(input.element.value).toBe('Emma')
      await enterValue(input, 'Persuasion')
      expect(await submit()).toEqual({ id: 1, title: 'Persuasion' })
    })

    it('reads the context of the form with useDitoContext()', async () => {
      let context = null
      const { wrapper } = await mountLayoutForm({
        props: ['schema', 'context'],
        setup() {
          context = useDitoContext()
          return () => h(DitoSchemaField, { name: 'title' })
        }
      })
      expect(context.item.title).toBe('Emma')
      expect(context.isDirty).toBe(false)
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      expect(context.item.title).toBe('Persuasion')
      expect(context.isDirty).toBe(true)
    })
  })

  describe('context.submit() outside of buttons', () => {
    const mountSubmittingForm = schema =>
      mountForm({
        schema: { fields: { title: { type: 'text' } }, ...schema },
        data: { title: 'Emma' },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })

    const getSubmits = request =>
      request.mock.calls
        .map(([{ method = 'get', url, data }]) => ({ method, url, data }))
        .filter(({ method }) => method !== 'get')

    it('submits with the submit button of the form in form events', async () => {
      let formContext = null
      const onSuccess = vi.fn()
      const { admin, request, settle } = await mountSubmittingForm({
        buttons: { submit: { onSuccess } },
        onLoad(context) {
          formContext = context
        }
      })
      expect(await formContext.submit()).toBe(true)
      await settle()
      expect(getSubmits(request)).toEqual([
        { method: 'patch', url: '/items/1', data: { id: 1, title: 'Emma' } }
      ])
      expect(onSuccess).toHaveBeenCalledTimes(1)
      // Unlike a click on the submit button, it leaves the form open:
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it('closes the form with `closeForm: true`', async () => {
      let formContext = null
      const { admin, settle } = await mountSubmittingForm({
        onLoad(context) {
          formContext = context
        }
      })
      expect(await formContext.submit({ closeForm: true })).toBe(true)
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('submits to the resource of the submit button', async () => {
      let layoutContext = null
      const { request, settle } = await mountSubmittingForm({
        component: {
          props: ['schema', 'context'],
          setup(props) {
            layoutContext = props.context
            return () => h(DitoSchemaField, { name: 'title' })
          }
        },
        buttons: {
          submit: { resource: { path: 'publish', method: 'post' } }
        }
      })
      expect(await layoutContext.submit()).toBe(true)
      await settle()
      expect(getSubmits(request)).toMatchObject([
        { method: 'post', url: '/items/1/publish' }
      ])
    })

    it('submits the form of useDitoContext() in layout components', async () => {
      let context = null
      const { wrapper, request, settle } = await mountSubmittingForm({
        component: {
          props: ['schema', 'context'],
          setup() {
            context = useDitoContext()
            return () => h(DitoSchemaField, { name: 'title' })
          }
        }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      expect(await context.submit()).toBe(true)
      await settle()
      expect(getSubmits(request)).toMatchObject([
        { method: 'patch', data: { title: 'Persuasion' } }
      ])
    })

    it('submits the form in callbacks of its fields', async () => {
      const { wrapper, request, settle } = await mountSubmittingForm({
        fields: {
          title: { type: 'text', onChange: ({ submit }) => submit() }
        }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(getSubmits(request)).toMatchObject([
        { method: 'patch', data: { title: 'Persuasion' } }
      ])
    })

    it('submits the form in callbacks of items of its lists', async () => {
      const { wrapper, request, settle } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text', onChange: ({ submit }) => submit() }
                }
              }
            }
          }
        },
        data: { chapters: [{ title: 'One' }] },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })
      await enterValue(
        wrapper.find('input[name="chapters/0/title"]'),
        'Opening'
      )
      await settle()
      expect(getSubmits(request)).toMatchObject([
        { method: 'patch', data: { chapters: [{ title: 'Opening' }] } }
      ])
    })

    it('throws in forms without a submit button', async () => {
      let formContext = null
      await mountSubmittingForm({
        buttons: { submit: false },
        onLoad(context) {
          formContext = context
        }
      })
      expect(() => formContext.submit()).toThrow(
        'Unable to submit: The form has no submit button.'
      )
    })

    it('throws in views, which have nothing to submit', async () => {
      let viewContext = null
      await mountSchema({
        schema: {
          fields: {
            title: {
              type: 'text',
              label(context) {
                viewContext = context
                return 'Title'
              }
            }
          }
        }
      })
      expect(() => viewContext.submit()).toThrow(
        'Unable to submit: There is no button of a form or source.'
      )
    })
  })

  it('reloads the data when navigating to another item', async () => {
    const books = {
      1: { id: 1, title: 'Emma' },
      2: { id: 2, title: 'Persuasion' }
    }
    const { admin, routeComponent, findField } = await mountForm({
      schema: { fields: { title: { type: 'text' } } },
      data: books[1],
      request: ({ method = 'get', url }) => {
        const id = url.match(/^\/items\/(\d+)$/)?.[1]
        if (method === 'get' && books[id]) return { data: books[id] }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    expect(findField('title').find('input').element.value).toBe('Emma')
    await admin.navigate('/items/2')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    // The same form stays open and loads the other item:
    expect(form).toBe(routeComponent)
    expect(form.data).toMatchObject({ id: 2, title: 'Persuasion' })
    expect(findField('title').find('input').element.value).toBe('Persuasion')
  })

  describe('writes of handlers', () => {
    async function mountPublishableForm(publish) {
      return mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            slug: {
              type: 'text',
              computeValue: ({ item }) => item.title.toLowerCase()
            },
            status: { type: 'text' }
          },
          buttons: {
            submit: { closeForm: false },
            publish: {
              type: 'button',
              label: 'Publish',
              onClick: publish
            }
          }
        },
        data: { title: 'Emma', status: 'draft' },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })
    }

    const clickPublish = async ({ findField, settle }) => {
      await findField('publish').trigger('click')
      await settle()
    }

    it('make the form dirty, like edits', async () => {
      const result = await mountPublishableForm(({ item }) => {
        item.status = 'published'
      })
      // The computed values that the data model writes aren't edits:
      expect(result.data.slug).toBe('emma')
      expect(result.routeComponent.routeContext.isDirty).toBe(false)
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.findField('status').find('input').element.value).toBe(
        'published'
      )
      expect(result.routeComponent.routeContext.isDirty).toBe(true)
    })

    it('are saved, and clean once the response is merged', async () => {
      const result = await mountPublishableForm(({ item }) => {
        item.title = 'Persuasion'
      })
      await clickPublish(result)
      expect(result.data.slug).toBe('persuasion')
      expect(await result.submit()).toMatchObject({
        title: 'Persuasion',
        slug: 'persuasion'
      })
      expect(result.routeComponent.routeContext.isDirty).toBe(false)
    })

    it(`don't make the form dirty if they keep the value`, async () => {
      const result = await mountPublishableForm(({ item }) => {
        item.status = 'draft'
      })
      await clickPublish(result)
      expect(result.routeComponent.routeContext.isDirty).toBe(false)
    })

    it(`don't make the form dirty for data without components`, async () => {
      const result = await mountPublishableForm(({ item }) => {
        Object.assign(item, { isPublishing: true })
      })
      await clickPublish(result)
      expect(result.data.isPublishing).toBe(true)
      expect(result.routeComponent.routeContext.isDirty).toBe(false)
    })

    it('go through the same item that all callbacks receive', async () => {
      // E.g. for state in a `WeakMap` keyed by the item:
      const items = new Set()
      const addItem = ({ item }) => {
        if (item) {
          items.add(item)
        }
        return true
      }
      const result = await mountForm({
        schema: {
          fields: {
            title: { type: 'text', if: addItem },
            slug: {
              type: 'text',
              computeValue: context => addItem(context) && 'emma'
            },
            publish: {
              type: 'button',
              onClick(context) {
                addItem(context)
                context.item.title = 'Persuasion'
              }
            }
          }
        },
        data: { title: 'Emma' }
      })
      await result.findField('publish').trigger('click')
      await result.settle()
      expect(items.size).toBe(1)
      expect(toRaw([...items][0])).toBe(toRaw(result.data))
      expect(result.data.title).toBe('Persuasion')
      expect(result.routeComponent.routeContext.isDirty).toBe(true)
    })

    it('make the draft of nested forms dirty, not the parent', async () => {
      const { admin, routeComponent, data } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text' },
                  rename: {
                    type: 'button',
                    onClick({ item }) {
                      item.title = 'Caladan'
                    }
                  }
                }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Arrakis' }] }
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      const button = admin.getComponent(form, `${form.dataPath}/rename`)
      await new DOMWrapper(button.$el).trigger('click')
      await settle(form)
      expect(form.data.title).toBe('Caladan')
      expect(form.routeContext.isDirty).toBe(true)
      expect(data.chapters[0].title).toBe('Arrakis')
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })
  })

  describe('dirty state', () => {
    const titleSchema = { fields: { title: { type: 'text' } } }

    it('stays dirty when an edit is reverted', async () => {
      const { wrapper, routeComponent, settle } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const input = wrapper.find('input[name="title"]')
      await enterValue(input, 'Persuasion')
      await enterValue(input, 'Emma')
      await settle()
      expect(routeComponent.routeContext.isDirty).toBe(true)
    })

    it('stays clean when excluded fields are edited', async () => {
      const { wrapper, routeComponent, settle } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            note: { type: 'text', exclude: true }
          }
        },
        data: { title: 'Emma', note: '' }
      })
      await enterValue(wrapper.find('input[name="note"]'), 'Later')
      await settle()
      expect(routeComponent.routeContext.isDirty).toBe(false)
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.routeContext.isDirty).toBe(true)
    })

    it('is clean once the changes are saved', async () => {
      const { wrapper, routeComponent, settle, submit } = await mountForm({
        schema: {
          ...titleSchema,
          buttons: { submit: { closeForm: false } }
        },
        data: { title: 'Emma' },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.routeContext.isDirty).toBe(true)
      expect(await submit()).toEqual({ id: 1, title: 'Persuasion' })
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('is never dirty without a submit button', async () => {
      const confirm = stubConfirm(false)
      const { admin, wrapper, routeComponent, settle } = await mountForm({
        schema: { ...titleSchema, buttons: { submit: false } },
        data: { title: 'Emma' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.routeContext.isDirty).toBe(false)
      await admin.navigate('/items')
      expect(confirm).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('is dirty with a submit button of another name', async () => {
      const { wrapper, routeComponent, settle } = await mountForm({
        schema: {
          ...titleSchema,
          buttons: { submit: false, save: { type: 'submit', label: 'Save' } }
        },
        data: { title: 'Emma' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.routeContext.isDirty).toBe(true)
    })

    it('stays clean when a component writes the value that it has', async () => {
      const form = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            tags: {
              type: 'multiselect',
              multiple: true,
              options: ['novel', 'classic']
            }
          },
          buttons: { submit: { closeForm: false } }
        },
        data: { title: 'Emma', tags: ['novel'] },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })
      // Components write their values through the data model:
      const write = (name, value) =>
        form.dataModel.set({ data: form.data, name, dataPath: name }, value)
      write('title', 'Emma')
      write('tags', ['novel'])
      await form.settle()
      expect(form.routeComponent.routeContext.isDirty).toBe(false)
      write('title', 'Persuasion')
      await form.submit()
      // E.g. components that write their value again after the save:
      write('title', 'Persuasion')
      await form.settle()
      expect(form.routeComponent.routeContext.isDirty).toBe(false)
    })

    describe('with lists that save their order through their resource', () => {
      async function mountChaptersForm() {
        const result = await mountForm({
          schema: {
            fields: {
              title: { type: 'text' },
              chapters: {
                type: 'list',
                resource: { path: 'chapters' },
                draggable: true,
                orderKey: 'position',
                columns: { title: {} },
                buttons: {
                  saveOrder: {
                    type: 'submit',
                    label: 'Save Order',
                    resource: { path: 'order', method: 'post' }
                  }
                }
              }
            },
            buttons: { submit: { closeForm: false } }
          },
          data: { title: 'Emma' },
          request: ({ method = 'get', url, data }) =>
            method === 'get' && url === '/items/1/chapters'
              ? { data: [{ id: 1, title: 'One' }, { id: 2, title: 'Two' }] }
              : { data: { id: 1, ...data } }
        })
        const { findField, settle } = result
        await enterValue(findField('title').find('input'), 'Persuasion')
        await findField('chapters')
          .findAll('.dito-button--drag')[0]
          .trigger('keydown', { key: 'ArrowDown', altKey: true })
        await settle()
        return result
      }

      it('keep the edits of the form dirty once the list saved its order', async () => {
        const { wrapper, routeComponent, request, settle } =
          await mountChaptersForm()
        expect(routeComponent.routeContext.isDirty).toBe(true)
        await wrapper.find('button[id$="saveOrder"]').trigger('click')
        await settle()
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'post',
            url: '/items/1/chapters/order'
          })
        )
        expect(routeComponent.routeContext.isDirty).toBe(true)
      })

      it('stay dirty once the form is saved, until they save', async () => {
        const { wrapper, routeComponent, submit, settle } =
          await mountChaptersForm()
        // The form's save doesn't carry the order of the list:
        expect(await submit()).toMatchObject({ title: 'Persuasion' })
        expect(routeComponent.routeContext.isDirty).toBe(true)
        await wrapper.find('button[id$="saveOrder"]').trigger('click')
        await settle()
        expect(routeComponent.routeContext.isDirty).toBe(false)
      })
    })

    it('is dirty after items are added, moved or removed', async () => {
      stubConfirm(true)
      const { findField, routeComponent, data, settle } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              inlined: true,
              creatable: true,
              draggable: true,
              deletable: true,
              form: { type: 'form', fields: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }, { title: 'Two' }] }
      })
      const { model: dataModel } = routeComponent.dataContext
      const field = findField('chapters')
      const expectDirtyAfter = async (selector, event = 'click', options) => {
        expect(routeComponent.routeContext.isDirty).toBe(false)
        await field.findAll(selector)[0].trigger(event, options)
        await settle()
        expect(routeComponent.routeContext.isDirty).toBe(true)
        dataModel.markClean()
      }
      const getTitles = () => data.chapters.map(chapter => chapter.title)
      // The first create button inserts before the first item:
      await expectDirtyAfter('.dito-create-button button')
      expect(getTitles()).toEqual([null, 'One', 'Two'])
      await expectDirtyAfter('.dito-button--drag', 'keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      expect(getTitles()).toEqual(['One', null, 'Two'])
      await expectDirtyAfter('.dito-button--remove')
      expect(data.chapters).toHaveLength(2)
    })
  })

  describe('submit() of items of lists in forms', () => {
    const createNestedListSchema = label => ({
      type: 'list',
      resource: { path: label.toLowerCase() },
      editable: true,
      itemLabel: 'name',
      columns: { name: {} },
      form: {
        type: 'form',
        label,
        fields: { name: { type: 'text' } }
      }
    })

    it('reloads the list of the saved item', async () => {
      const { admin, findField, settle } = await mountForm({
        schema: {
          fields: {
            notes: createNestedListSchema('Note'),
            tags: createNestedListSchema('Tag')
          }
        },
        data: { title: 'Emma' },
        request: ({ method = 'get', url, data }) => {
          if (method === 'get' && url.endsWith('/1')) {
            return { data: { id: 1, name: 'Draft' } }
          }
          return { data: method === 'get' ? [{ id: 1, name: 'Draft' }] : data }
        }
      })
      await findField('tags').find('.dito-button--edit').trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/tags/1')
      const getListLoads = () =>
        admin.request.mock.calls
          .map(([{ method = 'get', url }]) => `${method} ${url}`)
          .filter(call => /^get .*\/(note|tag)$/.test(call))
      const loads = getListLoads()
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(getListLoads().slice(loads.length)).toEqual([
        'get /items/1/tag'
      ])
    })
  })

  describe('saving', () => {
    // Mounts a book form with chapters edited in nested forms, and reviews
    // with their own resource. The server answers saves with `respond(data)`.
    function mountBookForm(respond = data => ({ id: 1, ...data })) {
      return mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                type: 'form',
                label: 'Chapter',
                fields: { title: { type: 'text' } }
              }
            },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              columns: { text: {} }
            }
          },
          buttons: { submit: { closeForm: false } }
        },
        data: {
          title: 'Emma',
          chapters: [
            { id: 1, title: 'One' },
            { id: 2, title: 'Two' }
          ],
          reviews: [{ id: 1, text: 'Witty' }]
        },
        request: ({ method = 'get', url, data }) =>
          method === 'get'
            ? url.endsWith('/reviews')
              ? { data: [{ id: 1, text: 'Witty' }] }
              : null
            : { data: respond(data) }
      })
    }

    it('keeps the identity of the item and its lists and items', async () => {
      const { wrapper, routeComponent, submit } = await mountBookForm()
      const { data } = routeComponent
      const { chapters, reviews } = data
      const [first, second] = chapters
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await submit()
      expect(routeComponent.data).toBe(data)
      expect(data.chapters).toBe(chapters)
      expect(data.chapters[0]).toBe(first)
      expect(data.chapters[1]).toBe(second)
      // The response doesn't contain the reviews, which have their own
      // resource, so they're kept:
      expect(data.reviews).toBe(reviews)
      expect(data.reviews).toEqual([{ id: 1, text: 'Witty' }])
      expect(data.title).toBe('Persuasion')
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('gives new items their ids from the response in place', async () => {
      const { routeComponent, submit } = await mountBookForm(data => ({
        id: 1,
        ...data,
        chapters: data.chapters.map((chapter, index) => ({
          ...chapter,
          id: index + 1
        }))
      }))
      const { chapters } = routeComponent.data
      const chapter = { title: 'Three' }
      routeComponent.dataContext.model.insert(
        {
          schema: routeComponent.schema.fields.chapters,
          list: chapters,
          dataPath: 'chapters'
        },
        2,
        chapter
      )
      await submit()
      expect(routeComponent.data.chapters[2]).toBe(chapters[2])
      expect(chapters[2]).toEqual({ id: 3, title: 'Three' })
    })

    it('removes the items that the server removed', async () => {
      const { routeComponent, submit } = await mountBookForm(data => ({
        id: 1,
        ...data,
        chapters: data.chapters.slice(1)
      }))
      const { chapters } = routeComponent.data
      const [, second] = chapters
      const { model } = routeComponent.dataContext
      model.set(
        { data: routeComponent.data, name: 'title', dataPath: 'title' },
        'Persuasion'
      )
      await submit()
      expect(routeComponent.data.chapters).toBe(chapters)
      expect(chapters).toEqual([second])
    })

    it('keeps the edits of open nested forms of its items', async () => {
      const { admin, routeComponent } = await mountBookForm()
      const { data } = routeComponent
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      await enterValue(
        new DOMWrapper(form.$el).find('input[name$="title"]'),
        'Opening'
      )
      // Save the book through its own submit button, outside the open form:
      const [submitButton] = [
        ...admin.element.querySelectorAll(
          '.dito-buttons--main button[type="submit"]'
        )
      ].filter(button => !form.$el.contains(button))
      submitButton.click()
      await settle(routeComponent)
      expect(form.data.title).toBe('Opening')
      expect(data.chapters[0].title).toBe('One')
    })

    it('merges the data of `resetItem()` and returns it', async () => {
      const { routeComponent } = await mountBookForm()
      const { data } = routeComponent
      const [first] = data.chapters
      const mergedData = routeComponent.dataContext.resetItem({
        ...data,
        title: 'Persuasion',
        chapters: [{ id: 1, title: 'First' }]
      })
      expect(mergedData).toBe(data)
      expect(routeComponent.data).toBe(data)
      expect(data.chapters).toEqual([first])
      expect(first.title).toBe('First')
      expect(data.title).toBe('Persuasion')
    })

    it('resets the item to the data like a replace', async () => {
      const { routeComponent } = await mountBookForm()
      const { data, dataContext } = routeComponent
      data.isSelected = true
      dataContext.markEdited()
      dataContext.resetItem({
        id: 1,
        chapters: [{ id: 1, title: 'First' }],
        reviews: [{ id: 1, text: 'Dull' }]
      })
      // Values without data get their defaults, like in replaced data:
      expect(data).not.toHaveProperty('isSelected')
      expect(data.title).toBe(null)
      expect(data.reviews).toEqual([{ id: 1, text: 'Dull' }])
      expect(dataContext.isDirty).toBe(false)
    })

    it('keeps the id and the type of the item in `resetItem()`', async () => {
      const item = { id: 1, type: 'book', title: 'Emma' }
      const admin = await mountAdmin({
        views: {
          items: {
            type: 'view',
            field: {
              type: 'list',
              resource: { path: 'items' },
              forms: {
                book: {
                  type: 'form',
                  fields: { title: { type: 'text', default: 'Untitled' } }
                },
                film: {
                  type: 'form',
                  fields: { director: { type: 'text' } }
                }
              }
            }
          }
        },
        request: ({ url }) => ({ data: url === '/items' ? [item] : item })
      })
      await admin.navigate('/items/1')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      form.dataContext.resetItem({})
      await settle(form)
      expect(form.data).toEqual({ id: 1, type: 'book', title: 'Untitled' })
      expect(Object.keys(form.schema.fields)).toEqual(['title'])
      form.dataContext.resetItem({ id: 2, type: 'film' })
      await settle(form)
      expect(form.data).toEqual({ id: 2, type: 'film', director: null })
    })
  })

  describe('mergeItem()', () => {
    const chapterForm = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        pages: { type: 'number' }
      }
    }

    // Mounts a book form whose export is run on the server, which owns the
    // status and the time of the export.
    async function mountBookForm({ mutate = false } = {}) {
      const result = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            exportStatus: { type: 'text', exclude: true },
            exportedAt: { type: 'date', exclude: true },
            exportLabel: {
              type: 'text',
              exclude: true,
              computeValue: ({ item }) => `Export ${item.exportStatus}`
            },
            chapters: {
              type: 'list',
              editable: true,
              mutate,
              form: chapterForm
            }
          }
        },
        data: {
          title: 'Emma',
          exportStatus: 'queued',
          exportedAt: null,
          chapters: [
            { id: 1, title: 'One', pages: 3 },
            { id: 2, title: 'Two', pages: 4 }
          ]
        }
      })
      const { context } = result.getComponent('title')
      return { ...result, context }
    }

    it('leaves the data as it is without values to merge', async () => {
      const { context } = await mountBookForm()
      const item = context.mergeItem(null)
      expect(item.title).toBe('Emma')
      expect(context.item.chapters).toHaveLength(2)
    })

    it('merges the values as loaded and keeps the form clean', async () => {
      const { data, context, settle } = await mountBookForm()
      const item = context.mergeItem({
        exportStatus: 'done',
        exportedAt: '2026-10-19T10:00:00.000Z',
        exportJob: { id: 7 }
      })
      await settle()
      expect(item).toBe(data)
      expect(data.title).toBe('Emma')
      expect(data.exportStatus).toBe('done')
      expect(data.exportedAt).toEqual(new Date('2026-10-19T10:00:00.000Z'))
      // Values without a component are assigned as they are:
      expect(data.exportJob).toEqual({ id: 7 })
      // Computed values that depend on the merged values run again:
      expect(data.exportLabel).toBe('Export done')
      expect(context.isDirty).toBe(false)
    })

    it('keeps the edits of other values and the dirty state', async () => {
      const { data, context, wrapper, settle } = await mountBookForm()
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      expect(context.isDirty).toBe(true)
      context.mergeItem({ exportStatus: 'done' })
      await settle()
      expect(data.title).toBe('Persuasion')
      expect(data.exportStatus).toBe('done')
      expect(context.isDirty).toBe(true)
    })

    it('merges lists by id to keep the identity of their items', async () => {
      const { data, context, settle } = await mountBookForm()
      const { chapters } = data
      const [first, second] = chapters
      context.mergeItem({
        chapters: [
          { id: 2, title: 'Two', pages: 5 },
          { id: 1, title: 'One', pages: 3 }
        ]
      })
      await settle()
      expect(data.chapters).toBe(chapters)
      expect(chapters).toEqual([second, first])
      expect(second.pages).toBe(5)
      expect(context.isDirty).toBe(false)
    })

    it('deserializes only the merged values, with the whole item', async () => {
      const { data, getComponent, settle } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            // Unnested components hold values of the item too:
            details: {
              type: 'section',
              fields: {
                status: {
                  type: 'text',
                  deserializeValue: ({ value, item }) =>
                    `${item.title}: ${value}`
                }
              }
            },
            tags: {
              type: 'text',
              deserializeValue: ({ value }) => value.join(', ')
            }
          }
        },
        data: { title: 'Emma', status: 'queued', tags: ['novel'] }
      })
      getComponent('title').context.mergeItem({ status: 'done' })
      await settle()
      expect(data).toEqual({
        id: 1,
        title: 'Emma',
        status: 'Emma: done',
        tags: 'novel'
      })
    })

    it('merges the values into the draft of nested forms', async () => {
      const { admin, data, routeComponent } = await mountBookForm()
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Opening')
      await settle(form)
      const { context } = admin.getComponent(form, `${form.dataPath}/title`)
      expect(context.mergeItem({ pages: 5 })).toBe(form.data)
      await settle(form)
      expect(form.data).toEqual({ id: 1, title: 'Opening', pages: 5 })
      expect(form.dataContext.isDirty).toBe(true)
      // The draft is only applied when the form is submitted:
      expect(data.chapters[0]).toEqual({ id: 1, title: 'One', pages: 3 })
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('merges the values into the item of nested forms with `mutate` in place', async () => {
      const { admin, data, routeComponent } = await mountBookForm({
        mutate: true
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      const [chapter] = data.chapters
      const { context } = admin.getComponent(form, `${form.dataPath}/title`)
      expect(context.mergeItem({ pages: 5 })).toBe(chapter)
      await settle(form)
      expect(data.chapters[0]).toBe(chapter)
      expect(chapter).toEqual({ id: 1, title: 'One', pages: 5 })
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('applies the excluded values merged into drafts without an edit', async () => {
      const { admin, data, routeComponent } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text' },
                  proofStatus: { type: 'text', exclude: true }
                }
              }
            }
          }
        },
        data: { chapters: [{ id: 1, title: 'One', proofStatus: 'queued' }] }
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      form.dataContext.mergeItem({ proofStatus: 'done' })
      await new DOMWrapper(form.$el)
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(data.chapters[0]).toEqual({
        id: 1,
        title: 'One',
        proofStatus: 'done'
      })
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('clears the errors of the merged values when they change', async () => {
      const { dataModel, routeComponent, getComponent, settle } =
        await mountForm({
          schema: {
            fields: {
              title: { type: 'text', required: true },
              exportStatus: { type: 'text', required: true, exclude: true }
            }
          },
          data: { title: '', exportStatus: '' }
        })
      routeComponent.dataContext.validate()
      await settle()
      expect(dataModel.getErrors('exportStatus')).toHaveLength(1)
      getComponent('title').context.mergeItem({ exportStatus: 'done' })
      await settle()
      expect(dataModel.getErrors('exportStatus')).toBe(null)
      expect(dataModel.getErrors('title')).toHaveLength(1)
    })

    it('clears the errors of the merged values also when they stay the same', async () => {
      const { dataModel, context, settle } = await mountBookForm()
      const errors = [{ message: 'is invalid' }]
      dataModel.replaceErrors(
        {
          'title': errors,
          'exportStatus': errors,
          'chapters/0/title': errors
        },
        { server: true }
      )
      context.mergeItem({
        exportStatus: 'queued',
        chapters: [
          { id: 1, title: 'One', pages: 3 },
          { id: 2, title: 'Two', pages: 4 }
        ]
      })
      await settle()
      expect(dataModel.getErrors('exportStatus')).toBe(null)
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(dataModel.getErrors('title')).toEqual(errors)
    })

    it('clears the errors of the merged values in the item of nested forms with `mutate`', async () => {
      const { admin, dataModel } = await mountBookForm({ mutate: true })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      const errors = [{ message: 'is invalid' }]
      dataModel.replaceErrors(
        { 'chapters/0/title': errors, 'chapters/0/pages': errors },
        { server: true }
      )
      form.dataContext.mergeItem({ pages: 3 })
      await settle(form)
      expect(dataModel.getErrors('chapters/0/pages')).toBe(null)
      expect(dataModel.getErrors('chapters/0/title')).toEqual(errors)
    })

    it('merges the values that components poll until they unmount', async () => {
      // Answer the polls in turn, and leave them pending until then, or until
      // their signal aborts, like `fetch()` does:
      const resolves = []
      const request = vi.fn(
        ({ signal }) =>
          new Promise((resolve, reject) => {
            resolves.push(resolve)
            signal.addEventListener('abort', () => reject(signal.reason))
          })
      )
      // Like the guide's polling example, without the time between the polls:
      const ExportProgress = {
        props: {
          schema: { type: Object, required: true },
          context: { type: Object, required: true }
        },

        mounted() {
          const { context } = this
          const poll = async () => {
            const { exportStatus, exportProgress } = await context.request({
              url: 'exports/1',
              abortOnUnmount: true
            })
            context.mergeItem({ exportStatus, exportProgress })
            poll()
          }
          poll()
        },

        render: () => h('p')
      }
      const { data, routeComponent, settle } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            exportStatus: { type: 'text', exclude: true },
            exportProgress: { type: 'number', exclude: true },
            exportJob: {
              type: 'component',
              component: ExportProgress,
              // The component unmounts once the export is done:
              if: ({ item }) => item.exportStatus !== 'done'
            }
          }
        },
        data: { title: 'Emma', exportStatus: 'queued', exportProgress: 0 },
        request
      })
      const respond = async data => {
        resolves.shift()({ data })
        await settle()
      }
      await respond({ exportStatus: 'running', exportProgress: 50 })
      expect(data).toMatchObject({
        exportStatus: 'running',
        exportProgress: 50
      })
      await respond({ exportStatus: 'done', exportProgress: 100 })
      expect(data).toMatchObject({ exportStatus: 'done', exportProgress: 100 })
      expect(routeComponent.routeContext.isDirty).toBe(false)
      // The poll that started before the component unmounted ends with it:
      expect(request).toHaveBeenCalledTimes(3)
      expect(request.mock.calls[2][0].signal.aborted).toBe(true)
    })
  })

  describe('nested forms of items in the form data', () => {
    const chapterForm = {
      type: 'form',
      label: 'Chapter',
      fields: { title: { type: 'text' } }
    }

    // Mounts a book form whose chapters and author are edited in nested forms,
    // which apply their changes to the data of the book form.
    async function mountBookForm({
      chapters = [],
      author = null,
      chapterEvents = {},
      computeChapters
    } = {}) {
      const result = await mountForm({
        schema: {
          label: 'Book',
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              creatable: true,
              itemLabel: 'title',
              computeValue: computeChapters,
              form: { ...chapterForm, ...chapterEvents }
            },
            author: {
              type: 'object',
              editable: true,
              creatable: true,
              form: {
                type: 'form',
                label: 'Author',
                fields: { name: { type: 'text' } }
              }
            }
          }
        },
        data: { title: 'Emma', chapters, author }
      })
      const notify = vi.spyOn(result.admin.context, 'notify')
      return { ...result, notify }
    }

    async function openNestedForm(admin, path) {
      await admin.navigate(path)
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      return form
    }

    // Enters `value` into the only input of the nested `form`, and submits the
    // form with its own submit button.
    async function submitNestedForm(form, value) {
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input'), value)
      await settle(form)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
    }

    it('provides the serialized draft and root item to its components', async () => {
      const { admin } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      form.data.title = 'Opening'
      const { context } = admin.getSchemaComponent(form)
      expect(context.serializedItem).toEqual({ title: 'Opening' })
      // The root item is the one of the book form, with the draft in place of
      // the item, like `rootItem`:
      expect(context.serializedRootItem).toMatchObject({
        title: 'Emma',
        chapters: [{ title: 'Opening' }]
      })
    })

    it('calls `onApply()` with the item label instead of `onSuccess()`', async () => {
      const onApply = vi.fn()
      const onSuccess = vi.fn()
      const { admin } = await mountBookForm({
        chapters: [{ title: 'Prologue' }],
        chapterEvents: { onApply, onSuccess }
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      await submitNestedForm(form, 'Opening')
      expect(onApply).toHaveBeenCalledTimes(1)
      expect(onApply.mock.calls[0][0].itemLabel).toBe(`Chapter 'Opening'`)
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('applies the changes of an item to the data of the form', async () => {
      const { admin, data, notify, routeComponent } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      expect(form.routeContext.state.isTransient).toBe(true)
      expect(form.data).toEqual({ title: 'Prologue' })
      await submitNestedForm(form, 'Opening')
      expect(data.chapters).toEqual([{ title: 'Opening' }])
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      // The applied changes make the book form dirty, not saved:
      expect(routeComponent.routeContext.isDirty).toBe(true)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Change Applied',
          html: [
            `Changes to Chapter 'Opening' were applied.`,
            expect.stringContaining('<b>Note</b>')
          ]
        })
      )
    })

    it('applies the response of buttons with resources to the draft', async () => {
      const { admin, data } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                ...chapterForm,
                buttons: {
                  proofread: {
                    type: 'submit',
                    text: 'Proofread',
                    resource: { path: '/proofread', method: 'post' }
                  }
                }
              }
            }
          }
        },
        data: { chapters: [{ title: 'prologue' }] },
        request: ({ method, url, data }) =>
          method === 'post' && url === '/proofread'
            ? { data: { title: data.title.toUpperCase() } }
            : null
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      await new DOMWrapper(form.$el)
        .find('button[id$="proofread"]')
        .trigger('click')
      await settle(form)
      // Unlike the submit button, other buttons don't close the form, which
      // holds the response in its draft until it's applied:
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      expect(form.data).toEqual({ title: 'PROLOGUE' })
      expect(data.chapters).toEqual([{ title: 'prologue' }])
      expect(form.routeContext.isDirty).toBe(true)
      await new DOMWrapper(form.$el)
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(data.chapters).toEqual([{ title: 'PROLOGUE' }])
    })

    it('adds created items to the list in the data of the form', async () => {
      const { admin, data, notify } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      expect(form.dataContext.isCreating).toBe(true)
      await submitNestedForm(form, 'Epilogue')
      expect(data.chapters).toEqual([
        { title: 'Prologue' },
        { title: 'Epilogue' }
      ])
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Item Added',
          html: [`Chapter 'Epilogue' was added.`, expect.any(String)]
        })
      )
    })

    it('update the sections of created items with computed values', async () => {
      const { admin } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              creatable: true,
              form: {
                type: 'form',
                fields: {
                  kind: { type: 'text', computeValue: () => 'draft' },
                  details: {
                    type: 'section',
                    fields: ({ item }) => ({
                      ...(item.kind === 'draft' && {
                        title: { type: 'text', default: 'Untitled' }
                      })
                    })
                  }
                }
              }
            }
          }
        },
        data: { chapters: [] }
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      expect(form.data).toEqual({ kind: 'draft', title: 'Untitled' })
    })

    it('edit the items that they added at their index', async () => {
      const { admin } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              creatable: true,
              form: {
                ...chapterForm,
                buttons: { submit: { closeForm: false } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Prologue' }] }
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      await submitNestedForm(form, 'Epilogue')
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/1')
      expect(form.data).toEqual({ title: 'Epilogue' })
    })

    it('edit the item of the index that they move to from creating', async () => {
      const { admin } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      await admin.navigate('/items/1/chapters/0')
      await settle(form)
      expect(admin.getRouteComponent(isForm)).toBe(form)
      expect(form.dataContext.isCreating).toBe(false)
      expect(form.data).toEqual({ title: 'Prologue' })
    })

    it('adds created items to lists stored as `null`', async () => {
      const { admin, data } = await mountBookForm({ chapters: null })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      await submitNestedForm(form, 'Epilogue')
      expect(data.chapters).toEqual([{ title: 'Epilogue' }])
    })

    it(`notifies the error when the list to add to is missing`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      // Computed values get no defaults, unlike the `null` of stored lists:
      const { admin, data, notify } = await mountBookForm({
        computeChapters: () => null
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      await submitNestedForm(form, 'Epilogue')
      expect(data.chapters).toBe(null)
      // The form stays open with the entered data:
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/chapters/create'
      )
      expect(form.data).toEqual({ title: 'Epilogue' })
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Could not submit transient item',
          html: `Unable to add Chapter 'Epilogue'.`
        })
      )
    })

    it('redirects missing objects to their create route', async () => {
      const { admin, data } = await mountBookForm({ author: null })
      const form = await openNestedForm(admin, '/items/1/author')
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/author/create'
      )
      expect(form.dataContext.isCreating).toBe(true)
      expect(form.data).toEqual({ name: null })
      await submitNestedForm(form, 'Jane Austen')
      expect(data.author).toEqual({ name: 'Jane Austen' })
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it('edits the objects that it created at their own route', async () => {
      const { admin } = await mountForm({
        schema: {
          fields: {
            author: {
              type: 'object',
              creatable: true,
              form: {
                type: 'form',
                fields: { name: { type: 'text' } },
                buttons: { submit: { closeForm: false } }
              }
            }
          }
        },
        data: { author: null }
      })
      const form = await openNestedForm(admin, '/items/1/author/create')
      await submitNestedForm(form, 'Jane Austen')
      expect(admin.router.currentRoute.value.path).toBe('/items/1/author')
      expect(form.data).toEqual({ name: 'Jane Austen' })
    })

    it('edits existing objects at their own route', async () => {
      const { admin, data } = await mountBookForm({
        author: { name: 'Jane' }
      })
      const form = await openNestedForm(admin, '/items/1/author')
      expect(form.dataContext.isCreating).toBe(false)
      expect(form.data).toEqual({ name: 'Jane' })
      await submitNestedForm(form, 'Jane Austen')
      expect(data.author).toEqual({ name: 'Jane Austen' })
    })
  })

  describe('applying nested forms', () => {
    // Mounts a book form whose chapters are edited in nested forms with the
    // `fields`, and opens the form of the `chapter`.
    async function openChapterForm(fields, chapter) {
      const submitted = []
      const result = await mountForm({
        schema: {
          label: 'Book',
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              columns: { title: {}, wordCount: {} },
              form: { type: 'form', label: 'Chapter', fields }
            }
          }
        },
        data: { title: 'Emma', chapters: [chapter] },
        request: ({ data }) => {
          submitted.push(data)
          return { data: { id: 1, ...data } }
        }
      })
      await result.admin.navigate('/items/1/chapters/0')
      const form = result.admin.getRouteComponent(isForm)
      await settle(form)
      return { ...result, form, submitted }
    }

    // Enters the `title` into the nested `form`, and applies it.
    async function applyChapterForm(form, title) {
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input[name$="title"]'), title)
      await settle(form)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
    }

    it('keeps the values of the item that the form leaves out', async () => {
      const { form, data } = await openChapterForm(
        { title: { type: 'text' } },
        { id: 7, title: 'Prologue', wordCount: 1200 }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([
        { id: 7, title: 'Opening', wordCount: 1200 }
      ])
    })

    it('keeps the excluded values of the item', async () => {
      const { form, data } = await openChapterForm(
        {
          title: { type: 'text' },
          note: { type: 'text', exclude: true }
        },
        { id: 7, title: 'Prologue', note: 'Draft' }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([
        { id: 7, title: 'Opening', note: 'Draft' }
      ])
    })

    it('keeps the related objects of the item whole', async () => {
      const authors = [
        { id: 1, name: 'Jane' },
        { id: 2, name: 'Tom' }
      ]
      const { form, data } = await openChapterForm(
        {
          title: { type: 'text' },
          author: {
            type: 'select',
            relate: true,
            options: { data: authors, label: 'name' }
          }
        },
        { id: 7, title: 'Prologue', author: { id: 1, name: 'Jane' } }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([
        { id: 7, title: 'Opening', author: { id: 1, name: 'Jane' } }
      ])
    })

    it('applies items with computed values that hold the item', async () => {
      const { form, data } = await openChapterForm(
        {
          title: { type: 'text' },
          details: {
            type: 'section',
            nested: true,
            fields: {
              chapter: {
                type: 'computed',
                exclude: true,
                computeValue: ({ parentItem }) => parentItem
              }
            }
          }
        },
        { id: 7, title: 'Prologue', details: {} }
      )
      await applyChapterForm(form, 'Opening')
      const [chapter] = data.chapters
      expect(chapter).toMatchObject({ id: 7, title: 'Opening' })
      // Not the draft that the form edited:
      expect(toRaw(chapter.details.chapter)).toBe(toRaw(chapter))
    })

    it(`doesn't make the parent dirty for excluded values`, async () => {
      const { form, routeComponent } = await openChapterForm(
        {
          title: { type: 'text' },
          note: { type: 'text', exclude: true }
        },
        { id: 7, title: 'Prologue', note: '' }
      )
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input[name$="note"]'), 'Later')
      await settle(form)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(routeComponent.data.chapters[0].note).toBe('Later')
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('calls `serializeValue()` only when the parent is saved', async () => {
      const { form, data, submit } = await openChapterForm(
        { title: { type: 'text', serializeValue: ({ value }) => `${value}!` } },
        { id: 7, title: 'Prologue' }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([{ id: 7, title: 'Opening' }])
      const submittedData = await submit()
      expect(submittedData.chapters).toEqual([{ id: 7, title: 'Opening!' }])
    })

    describe('with relations to items in their own data', () => {
      const chapterComponents = {
        title: { type: 'text' },
        sections: {
          type: 'list',
          inlined: true,
          creatable: true,
          form: { type: 'form', fields: { name: { type: 'text' } } }
        },
        featured: {
          type: 'select',
          relate: true,
          options: { dataPath: 'sections', label: 'name' }
        }
      }

      const chapter = {
        id: 7,
        title: 'Prologue',
        sections: [{ name: 'Opening' }],
        featured: null
      }

      it('resolve the options of data paths in the data of the form', async () => {
        const { admin, form } = await openChapterForm(
          chapterComponents,
          chapter
        )
        const featured = admin.getComponent(form, `${form.dataPath}/featured`)
        const sections = admin.getComponent(form, `${form.dataPath}/sections`)
        sections.$el.querySelector('.dito-create-button button').click()
        await settle(form)
        form.data.sections[1].name = 'Ending'
        await settle(form)
        expect(featured.options).toHaveLength(2)
        expect(featured.options[0]).toBe(form.data.sections[0])
      })

      it(`don't change the data of the parent when cancelled`, async () => {
        const { admin, form, data } = await openChapterForm(
          chapterComponents,
          chapter
        )
        const featured = admin.getComponent(form, `${form.dataPath}/featured`)
        featured.selectedValue = featured.getValueForOption(featured.options[0])
        await settle(form)
        expect(form.data.featured).not.toBe(data.chapters[0].sections[0])
        form.routeContext.close()
        await settle(form)
        expect(data.chapters[0].sections).toEqual([{ name: 'Opening' }])
      })

      it('send the related items with the ids of their references', async () => {
        const { admin, form, submit } = await openChapterForm(
          chapterComponents,
          chapter
        )
        const featured = admin.getComponent(form, `${form.dataPath}/featured`)
        featured.selectedValue = featured.getValueForOption(featured.options[0])
        await settle(form)
        await new DOMWrapper(form.$el)
          .find('.dito-buttons--main button[type="submit"]')
          .trigger('click')
        await settle(form)
        const [submittedChapter] = (await submit()).chapters
        expect(submittedChapter.featured['#ref']).toBeDefined()
        expect(submittedChapter.sections[0]['#id']).toBe(
          submittedChapter.featured['#ref']
        )
      })
    })
  })

  // Known bug: forms of resource lists in new items aren't transient
  it.skip('edits the items of resource lists in new items transiently', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          field: {
            type: 'list',
            resource: { path: 'books' },
            editable: true,
            creatable: true,
            form: {
              type: 'form',
              fields: {
                title: { type: 'text' },
                chapters: {
                  type: 'list',
                  resource: { path: 'chapters' },
                  editable: true,
                  creatable: true,
                  form: {
                    type: 'form',
                    fields: { title: { type: 'text' } }
                  }
                }
              }
            }
          }
        }
      },
      request: () => ({ data: [] })
    })
    await admin.navigate('/books/create')
    const bookForm = admin.getRouteComponent(isForm)
    await settle(bookForm)
    const chapters = admin.getComponent(bookForm, 'chapters')
    // Without the id of the book, the list can't load its chapters:
    expect(chapters.sourceContext.verbs.delete).toBe('remove')
    bookForm.data.chapters = [{ title: 'Prologue' }]
    await settle(bookForm)
    await admin.navigate('/books/create/chapters/0')
    const chapterForm = admin.getRouteComponent(isForm)
    await settle(chapterForm)
    expect(chapterForm.routeContext.state.isTransient).toBe(true)
    expect(chapterForm.data).toEqual({ title: 'Prologue' })
    expect(admin.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/books/chapters/0' })
    )
  })

  describe('submit() of new items', () => {
    it('opens the created item unless the form closes', async () => {
      const { admin, submit, routeComponent } = await mountForm({
        schema: {
          fields: { title: { type: 'text' } },
          buttons: { submit: { closeForm: false } }
        },
        request: ({ method, data }) =>
          method === 'post' ? { data: { id: 7, ...data } } : null
      })
      expect(routeComponent.dataContext.isCreating).toBe(true)
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      expect(await submit()).toEqual({ title: 'Emma' })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/7')
    })

    // The save response already put the created item in place, see the
    // `$route` watcher, so opening it doesn't load it again:
    it('opens the created item without loading it', async () => {
      const { admin, submit, routeComponent, request } = await mountForm({
        schema: {
          fields: { title: { type: 'text' } },
          buttons: { submit: { closeForm: false } }
        },
        request: ({ method, data }) =>
          method === 'post' ? { data: { id: 7, ...data } } : null
      })
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await submit()
      await settle(routeComponent)
      expect(admin.router.currentRoute.value.path).toBe('/items/7')
      expect(admin.getRouteComponent(isForm)).toBe(
        routeComponent
      )
      expect(routeComponent.dataContext.isCreating).toBe(false)
      expect(routeComponent.data).toEqual({ id: 7, title: 'Emma' })
      const itemRequests = request.mock.calls
        .map(([{ method = 'get', url }]) => [method, url])
        .filter(([, url]) => url.startsWith('/items'))
      expect(itemRequests).toEqual([['post', '/items']])
    })

    it('opens the created item by the id key of its list', async () => {
      const admin = await mountAdmin({
        views: {
          items: {
            type: 'view',
            field: {
              type: 'list',
              resource: { path: 'items' },
              idKey: 'code',
              form: {
                type: 'form',
                fields: { title: { type: 'text' } },
                buttons: { submit: { closeForm: false } }
              }
            }
          }
        },
        request: ({ method = 'get', data }) =>
          method === 'post'
            ? { data: { code: 'emma', ...data } }
            : { data: [] }
      })
      await admin.navigate('/items/create')
      const form = admin.getRouteComponent(isForm)
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(admin.router.currentRoute.value.path).toBe('/items/emma')
      expect(form.data).toEqual({ code: 'emma', title: 'Emma' })
    })
  })

  describe('events of saves', () => {
    const mountSavingForm = schema =>
      mountForm({
        schema: {
          fields: { title: { type: 'text' } },
          buttons: { submit: { closeForm: false } },
          ...schema
        },
        request: ({ method, data }) =>
          method === 'post'
            ? { data: { id: 7, ...data } }
            : method === 'patch'
              ? { data }
              : null
      })

    // Create the item, and save it again once the form edits it:
    const createAndSave = async ({ admin, submit, routeComponent }) => {
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await submit()
      await settle(routeComponent)
      expect(admin.router.currentRoute.value.path).toBe('/items/7')
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Persuasion')
      await submit()
    }

    it('call `onSuccess()` after creating and saving the item', async () => {
      const calls = []
      const result = await mountSavingForm({
        onSuccess({ item, isCreating }) {
          calls.push([item.title, isCreating])
        }
      })
      await createAndSave(result)
      expect(calls).toEqual([
        ['Emma', true],
        ['Persuasion', false]
      ])
    })

    it('pass the item label to `onSuccess()`', async () => {
      const labels = []
      const { admin, submit } = await mountSavingForm({
        label: 'Book',
        fields: { name: { type: 'text' } },
        onSuccess({ itemLabel }) {
          labels.push(itemLabel)
        }
      })
      await enterValue(admin.wrapper.find('input[name="name"]'), 'Emma')
      await submit()
      expect(labels).toEqual([`Book 'Emma'`])
    })

    it('suppress the notification when `onSuccess()` returns a value', async () => {
      const result = await mountSavingForm({ onSuccess: () => true })
      const notify = vi.spyOn(result.admin.context, 'notify')
      await createAndSave(result)
      expect(notify).not.toHaveBeenCalled()
    })

    it('suppress the notification when `onError()` returns a value', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn(() => true)
      const { submit, admin } = await mountForm({
        schema: { fields: { title: { type: 'text' } }, onError },
        data: { title: 'Emma' },
        request: ({ method = 'get', data }) => {
          if (method === 'get') return { data }
          throw new Error('Unavailable')
        }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await submit()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(notify).not.toHaveBeenCalled()
    })

    it('pass the item label to `onError()`', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const labels = []
      const { submit } = await mountForm({
        schema: {
          label: 'Book',
          fields: { name: { type: 'text' } },
          onError({ itemLabel }) {
            labels.push(itemLabel)
          }
        },
        data: { name: 'Emma' },
        request: ({ method = 'get', data }) => {
          if (method === 'get') return { data }
          throw new Error('Unavailable')
        }
      })
      await submit()
      expect(labels).toEqual([`Book 'Emma'`])
    })
  })

  describe('nested forms of items in views', () => {
    const recipesSchema = {
      type: 'list',
      editable: true,
      itemLabel: 'name',
      form: {
        type: 'form',
        label: 'Recipe',
        fields: { name: { type: 'text' } }
      }
    }

    async function submitChanges(form, name) {
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input'), name)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
    }

    // The data path of the nested form is relative to the data of the view,
    // without the path of the view.
    it('apply their changes to the data of the view', async () => {
      const { admin, data } = await mountSchema({
        schema: {
          fields: {
            recipes: recipesSchema,
            // Views with resources provide the data of their nested forms:
            cooks: {
              type: 'list',
              resource: { path: 'cooks' },
              columns: { name: {} }
            }
          }
        },
        data: { recipes: [{ name: 'Pancakes' }] },
        request: () => ({ data: [] })
      })
      await admin.navigate('/test/recipes/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.routeContext.parent.isForm).toBe(false)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Without a resource in the view, the nested form has no resource to
    // continue, and its data path is relative to the data of the view.
    it('open in views without resources', async () => {
      const { admin, data } = await mountSchema({
        schema: { fields: { recipes: recipesSchema } },
        data: { recipes: [{ name: 'Pancakes' }] }
      })
      await admin.navigate('/test/recipes/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.routeContext.resourceContext).toBe(null)
      expect(form.dataPath).toBe('recipes/0')
      expect(new DOMWrapper(form.$el).find('input').element.value).toBe(
        'Pancakes'
      )
      await submitChanges(form, 'Waffles')
      expect(data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Single-component views store the data of their component under the
    // view's name, also when the view's path differs from it.
    it('find their item in single-component views by name', async () => {
      const admin = await mountAdmin({
        views: {
          recipes: {
            type: 'view',
            path: 'cookbook',
            field: recipesSchema
          }
        }
      })
      await admin.navigate('/cookbook')
      const view = admin.getRouteComponent(isView)
      view.dataContext.resetItem({ recipes: [{ name: 'Pancakes' }] })
      await settle(view)
      await admin.navigate('/cookbook/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(view.data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Views in menus are nested in the route components of the menus, but
    // the data paths of their forms are relative to the view's data.
    it('find their item in views in menus', async () => {
      const admin = await mountAdmin({
        views: {
          kitchen: {
            type: 'menu',
            label: 'Kitchen',
            items: {
              cookbook: {
                type: 'view',
                fields: { recipes: recipesSchema }
              }
            }
          }
        }
      })
      await admin.navigate('/kitchen/cookbook')
      const view = admin.getRouteComponent(
        component => isView(component) && component.name === 'cookbook'
      )
      view.dataContext.resetItem({ recipes: [{ name: 'Pancakes' }] })
      await settle(view)
      await admin.navigate('/kitchen/cookbook/recipes/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(view.data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // The data paths of the form's components are relative to the data of
    // the view, which is their root item with the form's draft in place of
    // its item, also when the view has no resource.
    describe('without resources', () => {
      const recipesWithKitchenSchema = {
        ...recipesSchema,
        form: {
          ...recipesSchema.form,
          fields: {
            ...recipesSchema.form.fields,
            kitchen: {
              type: 'text',
              computeValue: ({ rootItem }) => rootItem?.venue ?? null
            }
          }
        }
      }

      function expectItemsOfComponents(admin, form, view) {
        const recipe = view.data.recipes[0]
        const name = admin.getComponent(form, 'recipes/0/name')
        const { rootData } = form.dataContext.model
        expect(rootData.venue).toBe('Bakery')
        expect(rootData.recipes[0]).toBe(form.data)
        expect(toRaw(name.context.rootItem)).toBe(toRaw(rootData))
        expect(toRaw(name.context.parentItem)).toBe(toRaw(rootData))
        expect(toRaw(name.context.item)).toBe(toRaw(form.data))
        expect(form.data).toEqual({ ...recipe, kitchen: 'Bakery' })
      }

      it('provide the root item in multi-component views', async () => {
        const { admin, routeComponent: view } = await mountSchema({
          schema: {
            fields: {
              venue: { type: 'text' },
              recipes: recipesWithKitchenSchema
            }
          },
          data: { venue: 'Bakery', recipes: [{ name: 'Pancakes' }] }
        })
        await admin.navigate('/test/recipes/0')
        const form = admin.getRouteComponent(isForm)
        await settle(form)
        expectItemsOfComponents(admin, form, view)
      })

      it('provide the root item in single-component views', async () => {
        const admin = await mountAdmin({
          views: {
            recipes: {
              type: 'view',
              path: 'cookbook',
              field: recipesWithKitchenSchema
            }
          }
        })
        await admin.navigate('/cookbook')
        const view = admin.getRouteComponent(isView)
        view.dataContext.resetItem({
          venue: 'Bakery',
          recipes: [{ name: 'Pancakes' }]
        })
        await settle(view)
        await admin.navigate('/cookbook/0')
        const form = admin.getRouteComponent(isForm)
        await settle(form)
        expectItemsOfComponents(admin, form, view)
      })
    })
  })

  describe('nested forms with `mutate`', () => {
    it('edit the item in the data of the parent form directly', async () => {
      const { admin, data, routeComponent } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              mutate: true,
              form: {
                type: 'form',
                fields: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Prologue' }] }
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.data).toBe(data.chapters[0])
      // Mutating forms write through the data model of their parent:
      expect(form.dataContext.model).toBe(routeComponent.dataContext.model)
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Opening')
      await settle(form)
      expect(data.chapters).toEqual([{ title: 'Opening' }])
      // The changes make the form that owns the data dirty, which mutating
      // forms report as theirs:
      expect(form.routeContext.isDirty).toBe(true)
      expect(routeComponent.routeContext.isDirty).toBe(true)
      // Mutating forms don't have a submit button, only the cancel button:
      expect(
        new DOMWrapper(form.$el)
          .find('.dito-buttons--main button[type="submit"]')
          .exists()
      ).toBe(false)
    })

    it('clear the errors of their item only once submitted', async () => {
      const { admin, routeComponent, dataModel } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              mutate: true,
              form: {
                type: 'form',
                fields: { title: { type: 'text' } },
                buttons: {
                  apply: {
                    type: 'submit',
                    onClick: ({ submit }) => submit()
                  }
                }
              }
            }
          }
        },
        data: { title: 'Emma', chapters: [{ title: 'Prologue' }] }
      })
      const errors = [{ message: 'is taken' }]
      dataModel.replaceErrors(
        { 'title': errors, 'chapters/0/title': errors },
        { server: true }
      )
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      expect(form).not.toBe(routeComponent)
      await new DOMWrapper(form.$el)
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(dataModel.getErrors('title')).toEqual(errors)
    })

    it('reset their item in place like loaded data', async () => {
      const { admin, data, dataModel } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              mutate: true,
              orderKey: 'position',
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text', default: 'Untitled' },
                  pages: { type: 'number' }
                }
              }
            }
          }
        },
        data: {
          chapters: [{ id: 1, position: 0, title: 'Prologue', pages: 3 }]
        }
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      const [chapter] = data.chapters
      dataModel.replaceErrors(
        { 'chapters/0/title': [{ message: 'is taken' }] },
        { server: true }
      )
      form.dataContext.resetItem({ pages: 5 })
      await settle(form)
      expect(data.chapters[0]).toBe(chapter)
      expect(chapter).toEqual({
        id: 1,
        position: 0,
        title: 'Untitled',
        pages: 5
      })
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(form.routeContext.isDirty).toBe(false)
    })

    const chapterForm = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        slug: {
          type: 'text',
          computeValue: ({ item }) => item.title?.toLowerCase() ?? null
        }
      }
    }

    it('compute the values of the items that they create', async () => {
      const { admin, data } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              creatable: true,
              mutate: true,
              form: chapterForm
            }
          }
        },
        data: { chapters: [] }
      })
      await admin.navigate('/items/1/chapters/create')
      const form = admin.getRouteComponent(
        component => component.dataContext.isCreating
      )
      await settle(form)
      // The new item isn't in the data of the parent, so the form handles it
      // with its own model:
      expect(form.dataContext.model).not.toBe(
        form.routeContext.parent.dataContext.model
      )
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Opening')
      await settle(form)
      expect(form.data).toMatchObject({ title: 'Opening', slug: 'opening' })
      expect(data.chapters).toEqual([])
    })

    it('compute the values of the items that they load', async () => {
      const admin = await mountAdmin({
        views: {
          chapters: {
            type: 'view',
            field: {
              type: 'list',
              resource: { path: 'chapters' },
              mutate: true,
              form: chapterForm
            }
          }
        },
        request: ({ url }) =>
          url === '/chapters'
            ? { data: [{ id: 1, title: 'Opening' }] }
            : { data: { id: 1, title: 'Opening' } }
      })
      await admin.navigate('/chapters/1')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.data).toMatchObject({ title: 'Opening', slug: 'opening' })
    })
  })

  // Navigating from an item to the create route in the same form doesn't load
  // the collection resource, see the `$route` watcher, but sets up a new item.
  it('sets up a new item when navigating to its create route', async () => {
    const { admin, routeComponent } = await mountForm({
      schema: { fields: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    await admin.navigate('/items/create')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    // The same form stays open and creates the new item:
    expect(form).toBe(routeComponent)
    expect(form.dataContext.isCreating).toBe(true)
    expect(form.routeContext.isDirty).toBe(false)
    expect(form.data).toEqual({ title: null })
  })

  it('computes the values of new items from their defaults', async () => {
    const computedValues = []
    const computeValue = ({ value }) => {
      computedValues.push(value)
      return value
    }
    const { admin } = await mountForm({
      schema: {
        fields: {
          title: { type: 'text', default: 'Untitled', computeValue }
        }
      }
    })
    await admin.navigate('/items/create')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(computedValues).not.toContain(undefined)
    expect(form.data).toEqual({ title: 'Untitled' })
  })

  // The load of the item that the form left is still pending, and mustn't
  // replace the new item when it completes, which would then be submitted:
  it('drops the pending load of an item when creating one', async () => {
    const pendingLoad = Promise.withResolvers()
    const { admin, routeComponent } = await mountForm({
      schema: { fields: { title: { type: 'text' } } },
      data: { title: 'Emma' },
      request: ({ method = 'get', url }) => {
        if (method === 'get' && url === '/items/2') return pendingLoad.promise
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    await admin.navigate('/items/2')
    await admin.navigate('/items/create')
    pendingLoad.resolve({ data: { id: 2, title: 'Persuasion' } })
    await settle(routeComponent)
    expect(routeComponent.dataContext.isCreating).toBe(true)
    expect(routeComponent.data).toEqual({ title: null })
  })

  it('loads the item when navigating to it from the create route', async () => {
    const { admin, routeComponent } = await mountForm({
      schema: { fields: { title: { type: 'text' } } },
      request: ({ method = 'get', url }) => {
        if (method === 'get' && url === '/items/1') {
          return { data: { id: 1, title: 'Emma' } }
        }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    expect(routeComponent.dataContext.isCreating).toBe(true)
    await admin.navigate('/items/1')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(form.dataContext.isCreating).toBe(false)
    expect(form.data).toEqual({ id: 1, title: 'Emma' })
  })

  it('creates the item of the type given by the route query', async () => {
    const admin = await mountAdmin({
      views: {
        blocks: {
          type: 'view',
          field: {
            type: 'list',
            resource: { path: 'blocks' },
            forms: {
              heading: {
                type: 'form',
                fields: { text: { type: 'text' } }
              },
              image: {
                type: 'form',
                fields: { url: { type: 'url' } }
              }
            }
          }
        }
      },
      request: () => ({ data: [] })
    })
    await admin.navigate('/blocks/create?type=image')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(form.data).toEqual({ type: 'image', url: null })
  })

  it('submits without validation with `validate: false`', async () => {
    const { wrapper, request, settle } = await mountForm({
      schema: {
        fields: { title: { type: 'text', required: true } },
        buttons: { submit: { closeForm: false } }
      },
      data: { title: '' },
      request: ({ data }) => ({ data })
    })
    const { submit } = wrapper
      .findAllComponents(DitoButtonType)
      .find(({ vm }) => vm.schema.type === 'submit').vm.context
    expect(await submit()).toBe(false)
    expect(await submit({ validate: false })).toBe(true)
    await settle()
    expect(
      request.mock.calls.filter(([{ method }]) => method === 'patch')
    ).toHaveLength(1)
  })

  // Errors of responses without a message, e.g. `{ type: 'ServerError' }`,
  // aren't shown as their object's string, "[object Object]":
  it('notifies errors without a message without the object', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { submit, notify } = await mountBookForm(() => {
      throw Object.assign(new Error('Request failed'), {
        response: { status: 500, data: { type: 'ServerError' } }
      })
    })
    await submit()
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        html: `Unable to save Book '${escapedName}'.`
      })
    )
  })

  it('renders and saves the deprecated `component` and `components`', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const book = { id: 1, title: 'Dune' }
    const request = vi.fn(({ method = 'get', url, data }) =>
      method === 'get'
        ? { data: url === '/books' ? [book] : book }
        : { data }
    )
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          component: {
            type: 'list',
            resource: { path: 'books' },
            form: { type: 'form', components: { title: { type: 'text' } } }
          }
        }
      },
      request
    })
    await admin.navigate('/books/1')
    await settle(admin.getRouteComponent(isForm))
    const input = admin.wrapper.find('input[name="title"]')
    expect(input.element.value).toBe('Dune')
    await enterValue(input, 'Emma')
    await admin.wrapper.find('button[id$="submit"]').trigger('click')
    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'patch',
          url: '/books/1',
          data: { id: 1, title: 'Emma' }
        })
      )
    )
    expect(warn.mock.calls).toEqual([
      [
        'The `component` of views with a schema is deprecated, ' +
        'use `field` instead.'
      ],
      ['Schema `components` are deprecated, use `fields` instead.']
    ])
  })
})

describe('deserializing', () => {
  // Stored as a list, edited as text:
  const tags = {
    type: 'text',
    deserializeValue: ({ value }) => value.join(', '),
    serializeValue: ({ value }) => value.split(', ')
  }

  it('deserializes the item that it loads', async () => {
    const { data } = await mountForm({
      schema: { fields: { tags } },
      data: { tags: ['novel', 'classic'] }
    })
    expect(data.tags).toBe('novel, classic')
  })

  it('deserializes the item that a save responds with', async () => {
    const { data, wrapper, submit } = await mountForm({
      schema: { fields: { tags } },
      data: { tags: ['novel'] },
      request: () => ({ data: { id: 1, tags: ['novel', 'classic'] } })
    })
    await enterValue(wrapper.find('input[name="tags"]'), 'novel, classic')
    expect(await submit()).toEqual({ id: 1, tags: ['novel', 'classic'] })
    expect(data.tags).toBe('novel, classic')
  })

  it('deserializes the data that nested forms replace their item with', async () => {
    const { admin, data } = await mountForm({
      schema: {
        fields: {
          chapters: {
            type: 'list',
            editable: true,
            form: { type: 'form', fields: { tags } }
          }
        }
      },
      data: { chapters: [{ tags: ['opening'] }] }
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    form.dataContext.resetItem({ tags: ['opening', 'short'] })
    expect(form.data.tags).toBe('opening, short')
    expect(form.dataContext.isDirty).toBe(false)
    expect(data.chapters[0].tags).toBe('opening')
  })
})
