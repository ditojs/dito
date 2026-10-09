import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountForm, unmountAdmin } from '../test/mount.js'

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
})
