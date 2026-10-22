// Test harness that mounts schemas in the real Dito.js admin: `DitoAdmin`
// creates the app with its provides, plugins and directives, `DitoRoot` sets
// up the routes of the views, and `DitoView` or `DitoForm` own the data and its
// `DataModel`. Only the network is stubbed: `api.request()` answers the session
// request with a user, and passes all other requests to the test's `request()`,
// unless a real server answers them, see `mountAdmin()`.
import { vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { VueWrapper, DOMWrapper, flushPromises } from '@vue/test-utils'
import { clone } from '@ditojs/utils'
import DitoAdmin from '../DitoAdmin.js'
import DitoView from '../components/DitoView.vue'
import DitoForm from '../components/DitoForm.vue'
import DitoFormEmbedded from '../components/DitoFormEmbedded.vue'
import DitoContainer from '../components/DitoContainer.vue'
import DitoSchema from '../components/DitoSchema.vue'
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

// Mounts a view with the properties of `schema`, e.g. its `fields`, and
// sets `data` as the view's data. Views don't submit, use `mountForm()` for
// forms with a resource that load and submit an item.
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
  const view = admin.getRouteComponent(isView)
  view.dataContext.resetItem(clone(data))
  await settle(view)
  return createMountResult(admin, view)
}

// Mounts a form with the properties of `schema`, e.g. its `fields`, for
// an item of a list with a resource, at `/items/1` when there's `data`, which
// the form loads as the item, or else at `/items/create`. Requests that the
// form makes for the item, e.g. to submit, are passed to `request()`, so the
// item isn't loaded through it. With a `path`, e.g. of a nested form, the admin
// starts there, as when reloading it, and returns its deepest form.
export async function mountForm({
  schema,
  data = null,
  request = null,
  path = null,
  ...options
}) {
  const id = data?.id ?? 1
  const admin = await mountAdmin({
    views: {
      items: {
        type: 'view',
        field: {
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
    path: path ?? '/',
    ...options
  })
  if (!path) {
    await admin.navigate(data ? `/items/${id}` : '/items/create')
  }
  const form = admin.getRouteComponent(isForm)
  await settle(form)
  return createMountResult(admin, form)
}

// Mounts `DitoAdmin` with `views` into a new element in the document, and
// waits until the views are resolved and their routes are set up, or until it
// asks to log in. `request(options)` handles the API requests other than the
// session request, and returns the response as `{ data }` or throws. With the
// URL of a `server`, e.g. of a scenario's app, the server answers all requests
// instead. The admin starts at `path`. `api` is merged into the API settings,
// e.g. `api.defaults` or `api.formats`, and `settings` and `authentication`
// are the ones of the `dito` object.
export async function mountAdmin({
  views,
  request = null,
  server = null,
  path = '/',
  api = {},
  settings = {},
  authentication = {},
  options = {}
}) {
  if (server) {
    // Run the admin on the server's origin, which keeps its session cookie:
    window.happyDOM.setURL(server)
  }
  // The router uses the web history, reset it to start at `path`:
  window.history.replaceState(null, '', path)
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
  window.dito = { base: '/', settings, authentication }
  const dito = new DitoAdmin(element, {
    dito: window.dito,
    api: server
      ? {
          url: '/',
          ...api,
          // Unlike browsers, happy-dom caches responses without cache headers:
          headers: { 'Cache-Control': 'no-cache', ...api.headers }
        }
      : { url: '/', ...api, request: requestStub },
    views,
    ...options
  })
  const { app, context } = dito
  const { router } = context
  const root = app._instance.proxy.$refs.root
  const wrapper = new VueWrapper(app, root)
  // Wait for `DitoRoot` to fetch the user and add the routes of the views, or
  // to ask to log in:
  await vi.waitFor(() => {
    if (!context.routeTree && !element.querySelector('.dito-dialog')) {
      throw new Error('Views not resolved yet')
    }
  })
  const admin = {
    dito,
    app,
    context,
    router,
    root,
    element,
    request: requestStub,
    wrapper,

    async navigate(path) {
      await router.push(path)
      await flushPromises()
    },

    // Returns the route components by route level that match `filter()`.
    getRouteComponents(filter = () => true) {
      const components = [DitoView, DitoForm, DitoFormEmbedded].flatMap(
        component =>
          wrapper.findAllComponents(component).map(({ vm }) => vm.$.proxy)
      )
      return context.ui.routes
        .map(route =>
          components.find(({ routeContext }) => routeContext === route)
        )
        .filter(component => component && filter(component))
    },

    // Returns the route component of the deepest route level that matches
    // `filter()`, e.g. the open form.
    getRouteComponent(filter) {
      return admin.getRouteComponents(filter).at(-1) ?? null
    },

    // Returns the container of the first type component in the data of
    // `routeComponent` that displays the value at `dataPath`, e.g.
    // `authors/0/name`. Unnested components, e.g. sections, are found by the
    // data path of their parent and their name, e.g. `authors/0/details`.
    getContainer(routeComponent, dataPath) {
      // The components in the data of the route component are registered in
      // the UI registry under its container:
      const containers = wrapper
        .findAllComponents(DitoContainer)
        .map(({ vm }) => vm)
        .filter(
          ({ componentPath }) => (
            context.ui.getHandles(componentPath, routeComponent.dataContext)
              .length > 0
          )
        )
      return (
        containers.find(
          container => container.nested && container.dataPath === dataPath
        ) ??
        containers.find(
          container => (
            !container.nested && (
              appendDataPath(container.dataPath, container.schema.name) ===
              dataPath
            )
          )
        ) ??
        null
      )
    },

    // Returns the type component of the container, see `getContainer()`.
    getComponent(routeComponent, dataPath) {
      return (
        admin.getContainer(routeComponent, dataPath)?.$refs.component ?? null
      )
    },

    // Returns the schema component that displays the data of `routeComponent`,
    // the first one of its data context:
    getSchemaComponent(routeComponent) {
      return (
        wrapper
          .findAllComponents(DitoSchema)
          .find(({ vm }) => vm.dataContext === routeComponent.dataContext)
          ?.vm ?? null
      )
    }
  }
  mountedAdmins.add(admin)
  return admin
}

// Mounts an admin with a `genres` view, which lists the options that editable
// components edit in their forms, see `DitoOptionsEditButtons`, and navigates
// to a `test` view with `fields` and `data`.
// Returns the `admin` and the `view`.
export async function mountAdminWithGenresView({ fields, data = {} }) {
  const admin = await mountAdmin({
    views: {
      genres: {
        type: 'view',
        field: {
          type: 'list',
          resource: { path: 'genres' },
          form: { type: 'form', fields: { name: { type: 'text' } } }
        }
      },
      test: { type: 'view', label: 'Test', fields }
    }
  })
  await admin.navigate('/test')
  const view = admin.getRouteComponent(isView)
  view.dataContext.resetItem(data)
  await settle(view)
  return { admin, view }
}

export function unmountAdmin(admin) {
  mountedAdmins.delete(admin)
  admin.app.unmount()
  admin.element.remove()
}

// Tell the route components of views and forms apart, e.g. in
// `admin.getRouteComponent(isForm)`:
export function isView(component) {
  return !component.routeContext.isForm
}

export function isForm(component) {
  return component.routeContext.isForm
}

// Waits until rendering, events and requests are done, and the data model of
// `component` settled, i.e. its options and data schemas are loaded and the
// computed values are written into the data.
export async function settle(component) {
  await flushPromises()
  await component.dataContext?.model.waitUntilSettled()
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
  const schemaComponent = admin.getSchemaComponent(routeComponent)

  // Returns the first type component of the route component's data that
  // displays the value at `dataPath`, e.g. `authors/0/name`. Unnested
  // components, e.g. sections, are found by the data path of their parent and
  // their name, e.g. `authors/0/details`.
  const getComponent = dataPath => admin.getComponent(routeComponent, dataPath)

  // Focuses the component at `dataPath`, revealing it first, as showing its
  // errors does.
  const focusField = dataPath =>
    admin.context.ui.reveal(
      routeComponent.dataContext,
      admin.getContainer(routeComponent, dataPath).componentPath,
      { focus: true }
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
    dataModel: routeComponent.dataContext.model,
    request: admin.request,
    get data() {
      return routeComponent.data
    },
    // Waits until the data model settled, see `settle()`.
    settle: () => settle(routeComponent),
    getComponent,
    focusField,
    findField,
    findContainer,
    getErrors,
    submit
  }
}
