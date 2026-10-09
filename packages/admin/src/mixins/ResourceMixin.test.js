import { vi, onTestFinished } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, mountSchema, unmountAdmin } from '../test/mount.js'
import { RequestError } from '../utils/request.js'

// Returns a request that is pending until `resolve()` or `reject()` is called,
// or until its signal aborts, like `fetch()` does.
function createPendingRequest() {
  const request = {}
  request.handle = ({ signal }) =>
    new Promise((resolve, reject) => {
      request.resolve = resolve
      request.reject = reject
      const abort = () =>
        reject(new DOMException('The request was aborted.', 'AbortError'))
      if (signal?.aborted) {
        abort()
      } else {
        signal?.addEventListener('abort', abort)
      }
    })
  return request
}

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

// Returns the error that `api.request()` throws for a response with `status`
// and `data`, see `request()` in `utils/request.js`.
function createRequestError(status, data) {
  return new RequestError({ status, statusText: 'Error', data })
}

function getNotifications() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => ({
      title: notification.querySelector('.notification-title')?.textContent,
      text: notification.querySelector('.notification-content')?.textContent
    })
  )
}

const bookSchema = {
  components: {
    title: { type: 'text' },
    publish: {
      type: 'button',
      resource: { path: 'publish', method: 'post' }
    }
  }
}

async function mountBookForm({ schema = bookSchema, request }) {
  const result = await mountForm({
    schema,
    data: { title: 'Orlando' },
    request
  })
  const form = result.routeComponent
  const button = result.getComponent('publish')
  return { ...result, form, button }
}

describe('ResourceMixin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('handleRequest()', () => {
    it('awaits async callbacks', async () => {
      const { form } = await mountBookForm({
        request: () => ({ data: { id: 1, title: 'Orlando' } })
      })
      let isCallbackDone = false
      await form.handleRequest(
        { method: 'get', resource: { path: 'books' } },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          isCallbackDone = true
        }
      )
      expect(isCallbackDone).toBe(true)
    })

    it(`doesn't call the callback again for errors that it throws`, async () => {
      const { form } = await mountBookForm({
        request: () => ({ data: { id: 1, title: 'Orlando' } })
      })
      const callback = vi.fn(error => {
        if (!error) throw new Error('Applying failed')
      })
      await expect(
        form.handleRequest(
          { method: 'get', resource: { path: 'books' } },
          callback
        )
      ).rejects.toThrow('Applying failed')
      expect(callback).toHaveBeenCalledOnce()
    })

    it('keeps the loading state until all requests are done', async () => {
      const first = createPendingRequest()
      const second = createPendingRequest()
      const { form } = await mountBookForm({
        request: options =>
          options.url.endsWith('first')
            ? first.handle(options)
            : second.handle(options)
      })
      const firstDone = form.handleRequest(
        { method: 'post', resource: { path: 'first' } },
        () => {}
      )
      const secondDone = form.handleRequest(
        { method: 'post', resource: { path: 'second' } },
        () => {}
      )
      await flushPromises()
      expect(form.isLoading).toBe(true)
      first.resolve({ data: {} })
      await firstDone
      expect(form.isLoading).toBe(true)
      second.resolve({ data: {} })
      await secondDone
      expect(form.isLoading).toBe(false)
    })
  })

  describe('setLoading()', () => {
    it('begins and ends a loading operation and warns once', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { form } = await mountBookForm({})
      const { rootComponent } = form
      expect(form.isLoading).toBe(false)
      form.setLoading(true)
      form.setLoading(true)
      expect(form.isLoading).toBe(true)
      expect(rootComponent.isLoading).toBe(true)
      form.setLoading(false)
      expect(form.isLoading).toBe(false)
      expect(rootComponent.isLoading).toBe(false)
      form.setLoading(false)
      expect(rootComponent.isLoading).toBe(false)
      const deprecationWarnings = warn.mock.calls.filter(([message]) =>
        String(message).includes('setLoading() is deprecated')
      )
      expect(deprecationWarnings).toHaveLength(1)
    })

    it('ends its loading operation when the component unmounts', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { form, admin } = await mountBookForm({})
      const { rootComponent } = form
      form.setLoading(true)
      expect(rootComponent.isLoading).toBe(true)
      await admin.navigate('/items')
      expect(rootComponent.isLoading).toBe(false)
    })
  })

  describe('requestData()', () => {
    it('aborts the pending data load when loading again', async () => {
      const loadRequests = []
      const { form } = await mountBookForm({
        request: options => {
          const loadRequest = createPendingRequest()
          loadRequests.push(loadRequest)
          return loadRequest.handle(options)
        }
      })
      const callback = vi.fn()
      const load = () =>
        form.handleRequest(
          { method: 'get', resource: { path: 'books' }, isDataLoad: true },
          callback
        )
      const firstLoaded = load()
      const secondLoaded = load()
      await flushPromises()
      loadRequests.at(-1).resolve({ data: { title: 'Orlando' } })
      await Promise.all([firstLoaded, secondLoaded])
      expect(callback).toHaveBeenCalledOnce()
      expect(form.isLoading).toBe(false)
    })

    it('aborts the pending data load when unmounted', async () => {
      const loadRequest = createPendingRequest()
      const { form, admin } = await mountBookForm({
        request: options => loadRequest.handle(options)
      })
      const callback = vi.fn()
      const loaded = form.handleRequest(
        { method: 'get', resource: { path: 'books' }, isDataLoad: true },
        callback
      )
      await flushPromises()
      unmountAdmin(admin)
      await loaded
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('submitResource()', () => {
    it(`isn't aborted by reloading the data`, async () => {
      const submitRequest = createPendingRequest()
      const { form, button } = await mountBookForm({
        request: options => submitRequest.handle(options)
      })
      const submitted = form.submit(button)
      await flushPromises()
      form.reloadData()
      await flushPromises()
      submitRequest.resolve({ data: { published: true } })
      expect(await submitted).toBe(true)
      expect(getNotificationTexts().join()).toContain(
        'Successfully Saved'
      )
    })

    it('waits for the success handlers of buttons', async () => {
      let finishHandler
      const { form } = await mountBookForm({
        schema: {
          components: {
            publish: {
              ...bookSchema.components.publish,
              events: {
                success: () =>
                  new Promise(resolve => {
                    finishHandler = resolve
                  })
              }
            }
          }
        },
        request: () => ({ data: { published: true } })
      })
      const button = form.mainSchemaComponent.getComponentByName('publish')
      let isSubmitted = false
      const submitted = form.submit(button).then(() => {
        isSubmitted = true
      })
      await vi.waitFor(() => expect(finishHandler).toBeDefined())
      await flushPromises()
      expect(isSubmitted).toBe(false)
      finishHandler()
      await submitted
      expect(isSubmitted).toBe(true)
    })

    it('completes when unmounted while pending', async () => {
      // Submits change data on the server, so they aren't aborted, unlike
      // data loads.
      const submitRequest = createPendingRequest()
      const { form, button, admin } = await mountBookForm({
        request: options => submitRequest.handle(options)
      })
      const callback = vi.fn()
      const submitted = form.handleRequest(
        { method: 'post', resource: button.resource },
        callback
      )
      await flushPromises()
      unmountAdmin(admin)
      submitRequest.resolve({ data: { published: true } })
      await submitted
      expect(callback).toHaveBeenCalledWith(null, {
        data: { published: true }
      })
    })
  })

  describe('handleRequest() errors', () => {
    const listSchema = {
      components: {
        books: {
          type: 'list',
          resource: { path: 'books' },
          form: { type: 'form', components: { title: { type: 'text' } } }
        }
      }
    }

    it('notifies failed loads with the type and message of the error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await mountSchema({
        schema: listSchema,
        request: () => {
          throw createRequestError(404, {
            type: 'NotFoundError',
            message: 'The books are gone.'
          })
        }
      })
      expect(getNotifications()).toContainEqual({
        title: 'Not Found Error',
        text: 'The books are gone.'
      })
    })

    it('notifies failed loads without error data with the error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await mountSchema({
        schema: listSchema,
        request: () => {
          throw new Error('Network down')
        }
      })
      expect(getNotifications()).toContainEqual({
        title: 'Error',
        text: 'Error: Network down'
      })
    })

    it('notifies errors that applying the loaded data throws', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await mountSchema({
        schema: {
          ...listSchema,
          // The list emits `'load'` on its schema:
          onLoad() {
            throw new Error('Unable to process the books')
          }
        },
        request: () => ({ data: [{ id: 1, title: 'Emma' }] })
      })
      expect(getNotifications()).toContainEqual({
        title: 'Error',
        text: 'Error: Unable to process the books'
      })
    })

    it('clears the abort controller once the data load is done', async () => {
      // Unlike browsers, happy-dom's `AbortController` has no `toStringTag`,
      // so Vue makes it reactive, and the stored controller is a proxy:
      Object.defineProperty(AbortController.prototype, Symbol.toStringTag, {
        value: 'AbortController',
        configurable: true
      })
      onTestFinished(() => {
        delete AbortController.prototype[Symbol.toStringTag]
      })
      const loadRequest = createPendingRequest()
      const { form } = await mountBookForm({
        request: options => loadRequest.handle(options)
      })
      const loaded = form.handleRequest(
        { method: 'get', resource: { path: 'books' }, isDataLoad: true },
        () => {}
      )
      await flushPromises()
      const controller = form.loadAbortController
      expect(controller).toBeInstanceOf(AbortController)
      loadRequest.resolve({ data: { title: 'Orlando' } })
      await loaded
      expect(form.loadAbortController).not.toBe(controller)
      expect(form.loadAbortController).toBe(null)
    })
  })

  describe('submit()', () => {
    it('submits list buttons to their resource relative to the list', async () => {
      const requests = []
      const { wrapper } = await mountSchema({
        schema: {
          components: {
            recipes: {
              type: 'list',
              resource: { path: 'recipes' },
              form: {
                type: 'form',
                components: { name: { type: 'text' } }
              },
              buttons: {
                publish: {
                  type: 'button',
                  resource: {
                    path: 'publish',
                    method: 'post',
                    data: { isPublic: true }
                  }
                }
              }
            }
          }
        },
        request: options => {
          requests.push(options)
          return options.method === 'post'
            ? { data: { published: true } }
            : { data: [{ id: 1, name: 'Risotto' }] }
        }
      })
      await wrapper.find('[id="recipes/$buttons/publish"]').trigger('click')
      await flushPromises()
      const post = requests.find(({ method }) => method === 'post')
      expect(post.url).toBe('/recipes/publish')
      expect(post.data).toEqual({ isPublic: true })
      expect(getNotificationTexts().join()).toContain('Request Successful')
    })
  })

  describe('submit() errors', () => {
    const mountRecipesWithPublishButton = request =>
      mountSchema({
        schema: {
          components: {
            recipes: {
              type: 'list',
              resource: { path: 'recipes' },
              form: {
                type: 'form',
                components: { name: { type: 'text' } }
              },
              buttons: {
                publish: {
                  type: 'button',
                  resource: { path: 'publish', method: 'post' }
                },
                share: { type: 'button' }
              }
            }
          }
        },
        request: options =>
          options.method === 'post'
            ? request(options)
            : { data: [{ id: 1, name: 'Risotto' }] }
      })

    const clickPublish = async wrapper => {
      await wrapper.find('[id="recipes/$buttons/publish"]').trigger('click')
      await flushPromises()
    }

    it('notifies the message of failed requests with data', async () => {
      const { wrapper } = await mountRecipesWithPublishButton(() => {
        throw createRequestError(500, { message: 'Publishing is closed.' })
      })
      await clickPublish(wrapper)
      expect(getNotifications()).toContainEqual({
        title: 'Request Error',
        text: 'Unable to send request: Publishing is closed.'
      })
    })

    it('notifies the error of failed requests without data', async () => {
      const { wrapper } = await mountRecipesWithPublishButton(() => {
        throw new Error('Network down')
      })
      await clickPublish(wrapper)
      expect(getNotifications()).toContainEqual({
        title: 'Request Error',
        text: 'Unable to send request: Network down'
      })
    })

    it('notifies failed requests with data without a message', async () => {
      const { wrapper } = await mountRecipesWithPublishButton(() => {
        throw createRequestError(500, { type: 'ServerError' })
      })
      await clickPublish(wrapper)
      expect(getNotifications()).toContainEqual({
        title: 'Request Error',
        text: 'Unable to send request.'
      })
    })

    it(`doesn't submit buttons without resource`, async () => {
      const request = vi.fn()
      const { wrapper, getComponent } =
        await mountRecipesWithPublishButton(request)
      const list = getComponent('recipes')
      const share = wrapper
        .findAllComponents({ name: 'DitoTypeButton' })
        .find(({ vm }) => vm.name === 'share').vm
      expect(await list.submit(share)).toBe(false)
      expect(request).not.toHaveBeenCalled()
    })
  })

  describe('unauthorized loads', () => {
    const reviewsSchema = {
      type: 'list',
      resource: { path: '/reviews' },
      form: { type: 'form', components: { text: { type: 'text' } } }
    }
    const unauthorized = ({ url }) => {
      if (url === '/reviews') {
        throw createRequestError(401, { message: 'Unauthorized' })
      }
    }
    const message = `You don't have permission to load this data.`

    it('shows the error on lists that load their data in forms', async () => {
      const { getComponent, getErrors } = await mountForm({
        schema: {
          components: { title: { type: 'text' }, reviews: reviewsSchema }
        },
        data: { title: 'Orlando' },
        request: unauthorized
      })
      expect(getErrors('reviews')).toEqual([message])
      // Loading again doesn't add the error twice:
      getComponent('reviews').reloadData()
      await flushPromises()
      expect(getErrors('reviews')).toEqual([message])
      expect(getNotifications()).toEqual([])
    })

    it('notifies the error on lists of views', async () => {
      const { getErrors } = await mountSchema({
        schema: { components: { reviews: reviewsSchema } },
        request: unauthorized
      })
      expect(getErrors('reviews')).toEqual([])
      expect(getNotifications()).toContainEqual({
        title: 'Error',
        text: 'Unauthorized'
      })
    })
  })

  describe('showing server validation errors', () => {
    const authorSchema = {
      label: 'Author',
      components: {
        name: { type: 'text' },
        books: {
          type: 'list',
          inlined: true,
          form: {
            type: 'form',
            components: { title: { type: 'text' } }
          }
        }
      }
    }

    async function submitWithErrors(errors) {
      const result = await mountForm({
        schema: authorSchema,
        data: { name: 'Woolf', books: [{ id: 1, title: 'Orlando' }] },
        request: options => {
          if (options.method !== 'get') {
            throw createRequestError(400, {
              type: 'ModelValidation',
              message: 'The provided data is not valid',
              errors
            })
          }
        }
      })
      await result.submit()
      return result
    }

    it('shows the errors on the fields at their normalized data paths', async () => {
      const { getErrors } = await submitWithErrors({
        'name': [{ message: 'must be unique' }],
        'books[0].title': [{ message: 'is too long' }]
      })
      expect(getErrors('name')).toEqual(['The Name field must be unique.'])
      expect(getErrors('books/0/title')).toEqual([
        'The Title field is too long.'
      ])
      // All errors were matched, so they're only pointed out:
      expect(getNotifications()).toContainEqual({
        title: 'Validation Errors',
        text: 'Please correct the highlighted errors.'
      })
      expect(getNotificationTexts().join()).not.toContain('The field')
    })

    it('notifies errors that no field displays', async () => {
      const { getErrors } = await submitWithErrors({
        'name': [{ message: 'must be unique' }],
        'publisher.city': [{ message: 'is required' }],
        '': [{ message: 'is incomplete' }]
      })
      expect(getErrors('name')).toEqual(['The Name field must be unique.'])
      // Unmatched errors are described by the last token of their data path,
      // and errors of the data itself by the label of the form:
      expect(getNotifications()).toContainEqual({
        title: 'Validation Errors',
        text: 'The field City is requiredThe Author is incomplete'
      })
    })

    async function mountFilteredBooks(errors) {
      const { wrapper } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              filters: { title: { filter: 'text' } },
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        request: () => {
          throw createRequestError(400, {
            type: 'FilterValidation',
            message: 'The provided data for query filter is not valid',
            errors
          })
        }
      })
      return wrapper
        .find('.dito-panel')
        .findAll('.dito-errors li')
        .map(item => item.text())
    }

    it('shows filter errors on the filters, prefixed with the panel data path', async () => {
      // The filters panel has its own data, which the errors are relative to:
      const errors = await mountFilteredBooks({
        '$title.text': [{ message: 'must be shorter' }]
      })
      expect(errors).toEqual(['The Text field must be shorter.'])
    })

    it('shows filter errors with the data paths of the server', async () => {
      // The server keys filter errors by filter name, see `filters.js`:
      const errors = await mountFilteredBooks({
        'title/text': [{ message: 'must be longer' }]
      })
      expect(errors).toEqual(['The Text field must be longer.'])
    })
  })
})
