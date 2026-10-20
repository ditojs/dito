import { vi } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import {
  mountForm,
  settle,
  enterValue,
  stubConfirm,
  isForm
} from '../test/mount.js'
import { RequestError } from '../utils/request.js'
import DitoButtonType from '../types/DitoButtonType.vue'

// How forms load and save their item through their resource, as they do now.

// Returns the requests other than the session request, as
// `[method, url, data]`.
function getRequests(request) {
  return request.mock.calls
    .map(([{ method = 'get', url, data }]) => [method, url, data])
    .filter(([, url]) => url !== '/session')
}

// Returns the error that `api.request()` throws for a response with `status`
// and `data`, see `request()` in `utils/request.js`.
function createRequestError(status, data) {
  return new RequestError({ status, statusText: 'Error', data })
}

function clickButton(element, label) {
  return new DOMWrapper(element)
    .find(`.dito-buttons--main button[aria-label="${label}"]`)
    .trigger('click')
}

// Mounts a form for books, which saves through `respond(method, data)`.
async function mountBookForm({
  data = { name: 'Emma', note: 'Classic' },
  respond = (method, data) => ({ data: { id: 1, ...data } }),
  schema
} = {}) {
  const result = await mountForm({
    schema: {
      label: 'Book',
      fields: {
        name: { type: 'text', required: true },
        note: { type: 'text' }
      },
      ...schema
    },
    data,
    request: ({ method = 'get', data }) =>
      method === 'get' ? null : respond(method, data)
  })
  const notify = vi.spyOn(result.admin.context, 'notify')
  return { ...result, notify }
}

describe('DitoForm resources', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading', () => {
    // The list of the item isn't loaded while its form is open:
    it('loads the item by its id, and emits `load` once', async () => {
      const loads = []
      const { request, data, routeComponent } = await mountBookForm({
        schema: {
          onLoad({ item }) {
            loads.push({ ...item })
          }
        }
      })
      expect(getRequests(request)).toEqual([['get', '/items/1', undefined]])
      expect(data).toEqual({ id: 1, name: 'Emma', note: 'Classic' })
      expect(loads).toEqual([{ id: 1, name: 'Emma', note: 'Classic' }])
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })
  })

  describe('saving', () => {
    it('patches the serialized item to the resource of the item', async () => {
      const { wrapper, request, submit } = await mountBookForm({
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      // The list of the item isn't reloaded while the form stays open:
      expect(getRequests(request)).toEqual([
        ['get', '/items/1', undefined],
        ['patch', '/items/1', { id: 1, name: 'Persuasion', note: 'Classic' }]
      ])
    })

    it('posts new items to the resource of the list', async () => {
      const { wrapper, request, submit } = await mountBookForm({
        data: null,
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Emma')
      await submit()
      // Opening the created item doesn't load it again:
      expect(getRequests(request)).toEqual([
        ['post', '/items', { name: 'Emma', note: '' }]
      ])
    })

    // Current behaviour, possibly a bug: the values that a save response
    // leaves out are reset to their defaults, also the ones that were sent:
    it('resets the values that the response leaves out', async () => {
      const { wrapper, data, routeComponent, submit } = await mountBookForm({
        respond: () => ({ data: { id: 1, name: 'Persuasion' } }),
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await enterValue(wrapper.find('input[name="note"]'), 'Late')
      await submit()
      expect(data).toEqual({ id: 1, name: 'Persuasion', note: '' })
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('takes the values of the response over the submitted ones', async () => {
      const { wrapper, data, submit } = await mountBookForm({
        respond: (method, data) => ({
          data: { ...data, name: data.name.toUpperCase() }
        }),
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      expect(data.name).toBe('PERSUASION')
    })

    it('keeps the item and cleans the form without response data', async () => {
      const { wrapper, data, routeComponent, submit } = await mountBookForm({
        respond: () => ({ data: null }),
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      expect(data).toEqual({ id: 1, name: 'Persuasion', note: 'Classic' })
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('submits buttons with resources relative to the item', async () => {
      const { admin, wrapper, data, request, routeComponent, settle } =
        await mountBookForm({
          respond: (method, data) => ({ data: { ...data, note: 'Published' } }),
          schema: {
            buttons: {
              publish: {
                type: 'submit',
                label: 'Publish',
                resource: { path: 'publish', method: 'post' }
              }
            }
          }
        })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await wrapper.find('button[id$="publish"]').trigger('click')
      await settle()
      expect(getRequests(request)).toContainEqual([
        'post',
        '/items/1/publish',
        { id: 1, name: 'Persuasion', note: 'Classic' }
      ])
      // Unlike the submit button, other buttons don't close the form:
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(data.note).toBe('Published')
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('keeps the form open and dirty when the save fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { admin, wrapper, data, routeComponent, submit } =
        await mountBookForm({
          respond: () => {
            throw new Error('Unavailable')
          }
        })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(data.name).toBe('Persuasion')
      expect(routeComponent.routeContext.isDirty).toBe(true)
    })

    it(`doesn't send invalid items`, async () => {
      const { wrapper, request, submit, getErrors } = await mountBookForm()
      await enterValue(wrapper.find('input[name="name"]'), '')
      expect(await submit()).toBe(null)
      expect(getRequests(request)).toHaveLength(1)
      expect(getErrors('name')).toEqual(['The Name field is required.'])
    })
  })

  describe('closing', () => {
    it('closes the form once the submit button saved', async () => {
      const confirm = stubConfirm(true)
      const { admin, wrapper, request, submit } = await mountBookForm()
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(admin.getRouteComponent(isForm)).toBe(null)
      expect(confirm).not.toHaveBeenCalled()
      expect(getRequests(request).slice(1)).toEqual([
        ['patch', '/items/1', expect.any(Object)],
        ['get', '/items', undefined]
      ])
    })

    it('closes the form of created items instead of opening them', async () => {
      const { admin, wrapper, submit } = await mountBookForm({
        data: null,
        respond: (method, data) => ({ data: { id: 7, ...data } })
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Emma')
      await submit()
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('closes the form with `closeForm` of `submit()`', async () => {
      const { admin, wrapper, settle } = await mountBookForm({
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      const { submit } = wrapper
        .findAllComponents(DitoButtonType)
        .find(({ vm }) => vm.schema.type === 'submit').vm.context
      expect(await submit({ closeForm: true })).toBe(true)
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })
  })

  describe('notifications', () => {
    it('notify created items with the label of the response', async () => {
      const { wrapper, notify, submit } = await mountBookForm({
        data: null,
        respond: (method, data) => ({
          data: { id: 7, ...data, name: 'Emma (1815)' }
        })
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Emma')
      await submit()
      expect(notify).toHaveBeenCalledWith({
        type: 'success',
        title: 'Successfully Created',
        html: `Book 'Emma (1815)' was created.`
      })
    })

    it('notify failed creates', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { wrapper, notify, submit } = await mountBookForm({
        data: null,
        respond: () => {
          throw createRequestError(500, { message: 'Storage is full.' })
        }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Emma')
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Request Error',
          html: [`Unable to create Book 'Emma':`, 'Storage is full.']
        })
      )
    })
  })

  describe('server validation errors', () => {
    const respondWithErrors = () => {
      throw createRequestError(400, {
        type: 'ModelValidation',
        message: 'The provided data is not valid',
        errors: { name: [{ message: 'must be unique' }] }
      })
    }

    it('show on the fields, and keep the form open and dirty', async () => {
      const onError = vi.fn()
      const { admin, wrapper, routeComponent, getErrors, submit } =
        await mountBookForm({ respond: respondWithErrors, schema: { onError } })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      expect(getErrors('name')).toEqual(['The Name field must be unique.'])
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(routeComponent.routeContext.isDirty).toBe(true)
      // Current behaviour, possibly a bug: validation errors of the server
      // don't emit the form's `error` event:
      expect(onError).not.toHaveBeenCalled()
    })

    it('are cleared once the item is saved', async () => {
      let respond = respondWithErrors
      const { wrapper, dataModel, getErrors, submit } = await mountBookForm({
        respond: (method, data) => respond(method, data),
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      expect(getErrors('name')).toHaveLength(1)
      respond = (method, data) => ({ data })
      await submit()
      expect(dataModel.getErrors('name')).toBe(null)
      expect(getErrors('name')).toEqual([])
    })
  })

  describe('drafts of nested forms', () => {
    async function openChapterForm() {
      const result = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              form: {
                type: 'form',
                fields: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { title: 'Emma', chapters: [{ id: 1, title: 'Prologue' }] },
        request: ({ data }) => ({ data })
      })
      await result.admin.navigate('/items/1/chapters/0')
      const form = result.admin.getRouteComponent(isForm)
      await settle(form)
      await enterValue(
        new DOMWrapper(form.$el).find('input[name$="title"]'),
        'Opening'
      )
      await settle(form)
      return { ...result, form }
    }

    it('are discarded when closed', async () => {
      const confirm = stubConfirm(true)
      const { admin, form, data, routeComponent } = await openChapterForm()
      expect(form.routeContext.isDirty).toBe(true)
      await clickButton(form.$el, 'Close')
      await settle(routeComponent)
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(data.chapters).toEqual([{ id: 1, title: 'Prologue' }])
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('stay open when the user keeps their changes', async () => {
      const confirm = stubConfirm(false)
      const { admin, form, data } = await openChapterForm()
      await admin.navigate('/items/1')
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      expect(form.data.title).toBe('Opening')
      expect(data.chapters[0].title).toBe('Prologue')
    })

    it('are sent with the item once applied and saved', async () => {
      const { form, submit } = await openChapterForm()
      await clickButton(form.$el, 'Apply')
      await settle(form)
      expect(await submit()).toEqual({
        id: 1,
        title: 'Emma',
        chapters: [{ id: 1, title: 'Opening' }]
      })
    })
  })

  describe('leave guard', () => {
    it('asks before cancelling changes', async () => {
      const confirm = stubConfirm(false)
      const onCancel = vi.fn()
      const { admin, wrapper, data, settle } = await mountBookForm({
        schema: { onCancel }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await clickButton(wrapper.element, 'Cancel')
      await settle()
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(data.name).toBe('Persuasion')
      expect(onCancel).not.toHaveBeenCalled()
    })

    it('asks before leaving once the save failed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const confirm = stubConfirm(false)
      const { admin, wrapper, submit } = await mountBookForm({
        respond: () => {
          throw new Error('Unavailable')
        }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      await admin.navigate('/items')
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it(`doesn't ask before leaving once the item is saved`, async () => {
      const confirm = stubConfirm(false)
      const { admin, wrapper, submit } = await mountBookForm({
        schema: { buttons: { submit: { closeForm: false } } }
      })
      await enterValue(wrapper.find('input[name="name"]'), 'Persuasion')
      await submit()
      await admin.navigate('/items')
      expect(confirm).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })
  })
})
