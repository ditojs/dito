import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, settle } from '../test/mount.js'

const maliciousName = '<img src="x" onerror="alert(1)">'
const escapedName = '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'

async function mountBookForm(request) {
  const result = await mountForm({
    schema: {
      label: 'Book',
      components: { name: { type: 'text' } }
    },
    data: { name: maliciousName },
    request
  })
  // The form notifies through the root component, see `DitoMixin.notify()`:
  const notify = vi.spyOn(result.admin.root, 'notify')
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
        components: { name: { type: 'text' } }
      },
      data: { name: 'Tom & Jerry' }
    })
    expect(wrapper.find('form.dito-scroll-parent').attributes('aria-label'))
      .toBe(`Show 'Tom & Jerry'`)
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
        schema: { label: 'Book', components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      await wrapper
        .find('.dito-buttons--main button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(admin.getRouteComponent(component => component.isForm)).toBe(
        null
      )
      // Cancelling doesn't send anything:
      expect(
        request.mock.calls.filter(([{ method = 'get' }]) => method !== 'get')
      ).toEqual([])
    })
  })

  it('reloads the data when navigating to another item', async () => {
    const books = {
      1: { id: 1, title: 'Emma' },
      2: { id: 2, title: 'Persuasion' }
    }
    const { admin, routeComponent, findField } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: books[1],
      request: ({ method = 'get', url }) => {
        const id = url.match(/^\/items\/(\d+)$/)?.[1]
        if (method === 'get' && books[id]) return { data: books[id] }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    expect(findField('title').find('input').element.value).toBe('Emma')
    await admin.navigate('/items/2')
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    // The same form stays open and loads the other item:
    expect(form).toBe(routeComponent)
    expect(form.data).toMatchObject({ id: 2, title: 'Persuasion' })
    expect(findField('title').find('input').element.value).toBe('Persuasion')
  })

  describe('applyCleanChanges()', () => {
    async function mountPublishableForm(publish) {
      return mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            status: { type: 'text' }
          },
          buttons: {
            publish: {
              type: 'button',
              label: 'Publish',
              events: { click: publish }
            }
          }
        },
        data: { title: 'Emma', status: 'draft' }
      })
    }

    const clickPublish = async ({ findField, settle }) => {
      await findField('publish').trigger('click')
      await settle()
    }

    it('applies changes that keep the form clean', async () => {
      const result = await mountPublishableForm(
        ({ formComponent, item }) =>
          formComponent.applyCleanChanges(() => {
            item.status = 'published'
          })
      )
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.findField('status').find('input').element.value).toBe(
        'published'
      )
      expect(result.routeComponent.isDirty).toBe(false)
    })

    it('makes the form dirty with plain changes', async () => {
      const result = await mountPublishableForm(({ item }) => {
        item.status = 'published'
      })
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.routeComponent.isDirty).toBe(true)
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
        components: { name: { type: 'text' } }
      }
    })

    it('reloads the list of the saved item', async () => {
      const { admin, findField, settle } = await mountForm({
        schema: {
          components: {
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
})
