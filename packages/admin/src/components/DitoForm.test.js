import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm } from '../test/mount.js'

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
