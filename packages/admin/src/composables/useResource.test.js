import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  unmountAdmin
} from '../test/mount.js'
import DitoButtonType from '../types/DitoButtonType.vue'
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

async function mountBookFormWithNotify(options) {
  const result = await mountBookForm(options)
  const notify = vi.spyOn(result.admin.context, 'notify')
  return { ...result, notify }
}

describe('useResource()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('requests', () => {
    it(`don't notify the errors of their handlers as request errors`, async () => {
      const { button, notify } = await mountBookFormWithNotify({
        schema: {
          components: {
            publish: {
              ...bookSchema.components.publish,
              onSuccess() {
                throw new Error('Publishing failed')
              }
            }
          }
        },
        request: () => ({ data: { published: true } })
      })
      await expect(button.context.submit()).rejects.toThrow('Publishing failed')
      expect(notify).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Request Error' })
      )
    })

    it('keep the loading state until all of them are done', async () => {
      const first = createPendingRequest()
      const second = createPendingRequest()
      const publish = bookSchema.components.publish
      const { admin, getComponent } = await mountBookForm({
        schema: {
          components: {
            first: { ...publish, resource: { path: 'first', method: 'post' } },
            second: { ...publish, resource: { path: 'second', method: 'post' } }
          }
        },
        request: options =>
          options.url.endsWith('first')
            ? first.handle(options)
            : second.handle(options)
      })
      const firstDone = getComponent('first').context.submit()
      const secondDone = getComponent('second').context.submit()
      await flushPromises()
      expect(admin.context.loadingTracker.isLoading).toBe(true)
      first.resolve({ data: {} })
      await firstDone
      expect(admin.context.loadingTracker.isLoading).toBe(true)
      second.resolve({ data: {} })
      await secondDone
      expect(admin.context.loadingTracker.isLoading).toBe(false)
    })
  })

  describe('data loads', () => {
    // Mounts the form of book 1, whose other books load until resolved:
    const mountBookFormWithPendingLoads = async () => {
      const loads = {}
      const result = await mountBookForm({
        request: options => {
          const id = options.url.match(/^\/items\/(\d+)$/)?.[1]
          const load = (loads[id] = createPendingRequest())
          return load.handle(options)
        }
      })
      return { ...result, loads }
    }

    it('abort the pending load when loading again', async () => {
      const { admin, form, loads } = await mountBookFormWithPendingLoads()
      await admin.navigate('/items/2')
      await admin.navigate('/items/3')
      // The first load was aborted, so its response is ignored:
      loads[2].resolve({ data: { id: 2, title: 'Emma' } })
      loads[3].resolve({ data: { id: 3, title: 'Persuasion' } })
      await flushPromises()
      expect(form.data).toMatchObject({ id: 3, title: 'Persuasion' })
      expect(admin.context.loadingTracker.isLoading).toBe(false)
    })

    it('abort the pending load when unmounted', async () => {
      const { admin, loads } = await mountBookFormWithPendingLoads()
      await admin.navigate('/items/2')
      const { signal } = admin.request.mock.calls.at(-1)[0]
      unmountAdmin(admin)
      expect(signal.aborted).toBe(true)
      loads[2].resolve({ data: { id: 2, title: 'Emma' } })
      await flushPromises()
      expect(getNotificationTexts()).toEqual([])
    })
  })

  describe('submits', () => {
    it(`aren't aborted by reloading the data`, async () => {
      const submitRequest = createPendingRequest()
      const { wrapper, getComponent } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} },
              buttons: {
                publish: {
                  type: 'button',
                  resource: { path: 'publish', method: 'post' }
                }
              }
            }
          }
        },
        request: options =>
          options.method === 'post'
            ? submitRequest.handle(options)
            : { data: [{ id: 1, title: 'Orlando' }] }
      })
      await wrapper.find('[id="books/$buttons/publish"]').trigger('click')
      await flushPromises()
      getComponent('books').sourceContext.reload()
      await flushPromises()
      submitRequest.resolve({ data: { published: true } })
      await flushPromises()
      expect(getNotificationTexts().join()).toContain('Request Successful')
    })

    it('wait for the success handlers of buttons', async () => {
      let finishHandler
      const { getComponent } = await mountBookForm({
        schema: {
          components: {
            publish: {
              ...bookSchema.components.publish,
              onSuccess: () =>
                new Promise(resolve => {
                  finishHandler = resolve
                })
            }
          }
        },
        request: () => ({ data: { published: true } })
      })
      const button = getComponent('publish')
      let isSubmitted = false
      const submitted = button.context.submit().then(() => {
        isSubmitted = true
      })
      await vi.waitFor(() => expect(finishHandler).toBeDefined())
      await flushPromises()
      expect(isSubmitted).toBe(false)
      finishHandler()
      await submitted
      expect(isSubmitted).toBe(true)
    })

    it('complete when unmounted while pending', async () => {
      // Submits change data on the server, so they aren't aborted, unlike
      // data loads.
      const submitRequest = createPendingRequest()
      const { button, admin } = await mountBookForm({
        request: options => submitRequest.handle(options)
      })
      const submitted = button.context.submit()
      await flushPromises()
      // The notifications are unmounted with the admin:
      vi.spyOn(admin.context, 'notify').mockImplementation(() => {})
      unmountAdmin(admin)
      submitRequest.resolve({ data: { published: true } })
      expect(await submitted).toBe(true)
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

    it('notifies failed loads of forms', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              ...listSchema.components.books,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        request: ({ url }) => {
          if (url === '/books/1') {
            throw createRequestError(401, {
              type: 'AuthorizationError',
              message: 'Unauthorized Access'
            })
          }
          return { data: [] }
        }
      })
      await admin.navigate('/books/1')
      expect(getNotifications()).toContainEqual({
        title: 'Authorization Error',
        text: 'Unauthorized Access'
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
      const { wrapper } = await mountRecipesWithPublishButton(request)
      const share = wrapper
        .findAllComponents(DitoButtonType)
        .find(({ vm }) => vm.schema.name === 'share').vm
      expect(await share.context.submit()).toBe(false)
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
      getComponent('reviews').sourceContext.reload()
      await flushPromises()
      expect(getErrors('reviews')).toEqual([message])
      expect(getNotifications()).toEqual([])
    })

    it('removes the error once the list loads', async () => {
      let isAuthorized = false
      const { getComponent, getErrors } = await mountForm({
        schema: {
          components: { title: { type: 'text' }, reviews: reviewsSchema }
        },
        data: { title: 'Orlando' },
        request: request =>
          isAuthorized ? { data: [] } : unauthorized(request)
      })
      expect(getErrors('reviews')).toEqual([message])
      isAuthorized = true
      getComponent('reviews').sourceContext.reload()
      await flushPromises()
      expect(getErrors('reviews')).toEqual([])
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
