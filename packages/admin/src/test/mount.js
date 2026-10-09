// Test harness that mounts schemas in the real Dito.js admin: `DitoAdmin`
// creates the app with its provides, plugins and directives, `DitoRoot` sets
// up the routes of the views, and `DitoView` or `DitoForm` own the data and its
// `DataModel`. Only the network is stubbed: `api.request()` answers the session
// request with a user, and passes all other requests to the test's `request()`.
import { vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { VueWrapper, DOMWrapper, flushPromises } from '@vue/test-utils'
import { clone } from '@ditojs/utils'
import DitoAdmin from '../DitoAdmin.js'
import appState from '../appState.js'
import { appendDataPath } from '../utils/data.js'

const mountedAdmins = new Set()
const confirmObservers = new Set()

// Unmounts all admins that are still mounted, see `mountAdmin()`. Called after
// each test, so tests don't need to clean up themselves.
afterEach(() => {
  for (const admin of mountedAdmins) {
    unmountAdmin(admin)
  }
  for (const observer of confirmObservers) {
    observer.disconnect()
  }
  confirmObservers.clear()
  vi.unstubAllGlobals()
})

// Mounts a view with the properties of `schema`, e.g. its `components`, and
// sets `data` as the view's data. Views don't track dirty state and don't
// submit, use `mountForm()` for that.
// Returns the `wrapper` of the root, the reactive `data`, the view's
// `dataModel`, and the `view` and its `schemaComponent`.
export async function mountSchema({
  schema,
  data = {},
  ...options
}) {
  const name = 'test'
  const admin = await mountAdmin({
    views: {
      [name]: { type: 'view', label: 'Test', ...schema }
    },
    ...options
  })
  await admin.navigate(`/${name}`)
  const view = admin.getRouteComponent(component => component.isView)
  view.setData(clone(data))
  await settle(view)
  return createMountResult(admin, view)
}

// Mounts a form with the properties of `schema`, e.g. its `components`, for
// an item of a list with a resource, at `/items/1` when there's `data`, which
// the form loads as the item, or else at `/items/create`. Requests that the
// form makes for the item, e.g. to submit, are passed to `request()`, so the
// item isn't loaded through it.
export async function mountForm({
  schema,
  data = null,
  request = null,
  ...options
}) {
  const id = data?.id ?? 1
  const admin = await mountAdmin({
    views: {
      items: {
        type: 'view',
        component: {
          type: 'list',
          resource: { path: 'items' },
          form: { type: 'form', ...schema }
        }
      }
    },
    request(options) {
      const { method = 'get', url } = options
      if (method === 'get' && url === '/items') {
        return { data: data ? [{ id, ...data }] : [] }
      }
      if (method === 'get' && url === `/items/${id}` && data) {
        return { data: { id, ...clone(data) } }
      }
      return request?.(options)
    },
    ...options
  })
  await admin.navigate(data ? `/items/${id}` : '/items/create')
  const form = admin.getRouteComponent(component => component.isForm)
  await settle(form)
  return createMountResult(admin, form)
}

// Mounts `DitoAdmin` with `views` into a new element in the document, and
// waits until the views are resolved and their routes are set up.
// `request(options)` handles the API requests other than the session request,
// and returns the response as `{ data }` or throws. `api` is merged into the
// API settings, e.g. `api.defaults` or `api.formats`.
export async function mountAdmin({ views, request = null, api = {} }) {
  // The router uses the web history, reset it to start at the root:
  window.history.replaceState(null, '', '/')
  const element = document.createElement('div')
  document.body.appendChild(element)
  const requestStub = vi.fn(async options => {
    const { method = 'get', url } = options
    if (method === 'get' && url === '/session') {
      return { data: { user: { id: 1, username: 'tester' } } }
    }
    if (!request) {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
    return request(options)
  })
  // `AdminController` provides the `dito` object as `window.dito` too:
  window.dito = { base: '/', settings: {} }
  const dito = new DitoAdmin(element, {
    dito: window.dito,
    api: { url: '/', ...api, request: requestStub },
    views
  })
  const { app } = dito
  const router = app.config.globalProperties.$router
  const root = app._instance.proxy.$refs.root
  // Wait for `DitoRoot` to fetch the user and add the routes of the views:
  await vi.waitFor(() => {
    if (!root.viewRegistry.hasRoutes) throw new Error('Views not resolved yet')
  })
  const admin = {
    dito,
    app,
    router,
    root,
    element,
    request: requestStub,
    wrapper: new VueWrapper(app, root),

    async navigate(path) {
      await router.push(path)
      await flushPromises()
    },

    // Returns the route component of the deepest route level that matches
    // `filter()`, e.g. the open form.
    getRouteComponent(filter = () => true) {
      return appState.routeComponents.findLast(filter) ?? null
    }
  }
  mountedAdmins.add(admin)
  return admin
}

export function unmountAdmin(admin) {
  mountedAdmins.delete(admin)
  admin.app.unmount()
  admin.element.remove()
  // `DitoRoot` sets the user, which outlives the app in the shared app state:
  appState.user = null
  appState.routeComponents = []
}

// Waits until rendering, events and requests are done, and the data model of
// `component` settled, i.e. its options and data schemas are loaded and the
// computed values are written into the data.
export async function settle(component) {
  await flushPromises()
  await component.dataModel?.waitUntilSettled()
  await flushPromises()
  await nextTick()
}

// Answers the confirmation dialogs, e.g. to delete items, see `confirm()` in
// `utils/dialogs.js`: Once a dialog shows, the returned mock is called with the
// text of its message, and its return value decides whether to click the
// confirm or the cancel button. Change the answer and check the questions
// through the mock. The answering stops after each test.
export function stubConfirm(answer = true) {
  const confirm = vi.fn(() => answer)
  const observer = new MutationObserver(() => {
    for (const message of document.querySelectorAll(
      '.dito-dialog .dito-confirm-message:not([data-answered])'
    )) {
      message.dataset.answered = ''
      const dialog = message.closest('.dito-dialog')
      const button = confirm(message.textContent)
        ? dialog.querySelector('button[type="submit"]')
        : dialog.querySelector('.dito-button--cancel')
      button.click()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  confirmObservers.add(observer)
  return confirm
}

// Enters `value` into the input or textarea of `wrapper` like a user does:
// Unlike `setValue()`, which triggers `change` right after `input`, the
// `change` event is triggered once the input updated the data, as in browsers.
export async function enterValue(wrapper, value) {
  wrapper.element.value = value
  await wrapper.trigger('input')
  await flushPromises()
  await wrapper.trigger('change')
  await flushPromises()
}

function createMountResult(admin, routeComponent) {
  const { wrapper } = admin
  const schemaComponent = routeComponent.mainSchemaComponent

  // Returns the type component that displays the value at `dataPath`,
  // relative to the route component's data, e.g. `authors/0/name`. Unnested
  // components, e.g. sections, are found by the data path of their parent and
  // their name, e.g. `authors/0/details`.
  const getComponent = dataPath => (
    schemaComponent.getComponentByDataPath(dataPath) ??
    wrapper
      .findAllComponents({ name: 'DitoSchema' })
      .flatMap(({ vm }) => vm.unnestedComponents)
      .find(
        component => (
          appendDataPath(component.dataPath, component.name) === dataPath
        )
      ) ??
    null
  )

  // Returns a wrapper of `element`, or an empty one that doesn't exist:
  const wrapElement = element =>
    element ? new DOMWrapper(element) : wrapper.find('.dito-missing-element')

  // Returns the wrapper of the element of the component at `dataPath`.
  const findField = dataPath => wrapElement(getComponent(dataPath)?.$el)

  // Returns the wrapper of the container of the component at `dataPath`,
  // with its label, the component and its errors.
  const findContainer = dataPath =>
    wrapElement(getComponent(dataPath)?.$el?.closest?.('.dito-container'))

  // Returns the error messages that the component at `dataPath` displays.
  const getErrors = dataPath => {
    const container = findContainer(dataPath)
    return container.exists()
      ? container.findAll('.dito-errors li').map(item => item.text())
      : []
  }

  // Clicks the submit button of the form, see `mountForm()`, and returns the
  // data that it sent, or `null` if it didn't send any, e.g. when the data is
  // invalid.
  const submit = async () => {
    const callCount = admin.request.mock.calls.length
    await wrapper
      .find('.dito-buttons--main button[type="submit"]')
      .trigger('click')
    await settle(routeComponent)
    const call = admin.request.mock.calls
      .slice(callCount)
      .find(([{ method = 'get' }]) => method !== 'get')
    return call?.[0].data ?? null
  }

  return {
    admin,
    wrapper,
    routeComponent,
    schemaComponent,
    dataModel: routeComponent.dataModel,
    request: admin.request,
    get data() {
      return routeComponent.data
    },
    // Waits until the data model settled, see `settle()`.
    settle: () => settle(routeComponent),
    getComponent,
    findField,
    findContainer,
    getErrors,
    submit
  }
}
