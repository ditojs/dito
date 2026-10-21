import { vi } from 'vitest'
import { h } from 'vue'
import { useRoute } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue, stubConfirm } from '../test/mount.js'
import { RequestError } from '../utils/request.js'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoSchemaField,
  DitoPane
} from '../index.js'

const fields = {
  name: { type: 'text', label: 'Name', required: true, width: '1/2' },
  price: { type: 'number', label: 'Price', width: '1/2' },
  notes: { type: 'textarea', label: 'Notes' }
}

// The form of the page, set up by `ProductPage`:
let form = null

// A page that loads the product of its route's id, or creates one without:
const ProductPage = {
  setup() {
    const route = useRoute()
    form = useDitoForm({
      resource: 'products',
      id: () => route.params.id || null,
      fields
    })
    return () =>
      h('div', { class: 'product-page' }, [
        h(DitoSchemaForm),
        h('button', { class: 'publish', onClick: () => form.submit() })
      ])
  }
}

// A page that lays out its form's fields:
const LayoutPage = {
  setup() {
    useDitoForm({ resource: 'products', id: 7, fields })
    return () =>
      h(DitoSchemaForm, null, {
        default: () =>
          h('div', { class: 'layout' }, [
            h(DitoPane, { names: ['name', 'price'] }),
            h('aside', 'Preview'),
            h(DitoSchemaField, { name: 'notes' })
          ])
      })
  }
}

const getSentRequests = request =>
  request.mock.calls
    .map(([options]) => options)
    .filter(({ method = 'get' }) => method !== 'get')
    .map(({ method, url, data }) => ({ method, url, data }))

// Dispatches `beforeunload` like the browser does when the page is reloaded or
// closed, and returns whether the page asks to stay.
function isUnloadPrevented() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

async function settleForm() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve))
  await flushPromises()
}

async function mountProductPage({
  path = '/products/7',
  views = {},
  api = {}
} = {}) {
  const products = {
    7: { id: 7, name: 'Chair', price: 120, notes: null },
    9: { id: 9, name: 'Lamp', price: 40, notes: null }
  }
  const request = vi.fn(({ method = 'get', url, data }) => {
    if (method === 'get' && url.startsWith('/products/')) {
      return { data: { ...products[url.split('/').pop()] } }
    } else if (method === 'patch') {
      return { data: { ...data } }
    } else if (method === 'post') {
      return { data: { ...data, id: 8 } }
    } else {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const admin = await mountAdmin({
    views: {
      books: { type: 'view', label: 'Books', fields: {} },
      product: {
        type: 'page',
        label: 'Product',
        path: 'products/:id?',
        component: ProductPage
      },
      layout: {
        type: 'page',
        label: 'Layout',
        path: 'layout',
        component: LayoutPage
      },
      ...views
    },
    request,
    api
  })
  const notify = vi.spyOn(admin.context, 'notify')
  await admin.navigate(path)
  await settleForm()
  const page = admin.wrapper.find('.product-page')
  return { admin, notify, request, page }
}

const getSubmitButton = page =>
  page.find('.dito-buttons--main button[type="submit"]')

// Submit buttons show the verb of their form, e.g. `save` or `create`:
const getSubmitVerb = page => getSubmitButton(page).attributes('aria-label')

describe('useDitoForm()', () => {
  afterEach(() => {
    form = null
  })

  it('loads the item of its id and renders its fields like forms', async () => {
    const { page } = await mountProductPage()
    const containers = page.findAll('.dito-pane .dito-container')
    expect(containers.map(c => c.find('.dito-label').text())).toEqual([
      'Name',
      'Price',
      'Notes'
    ])
    expect(containers[0].attributes('style')).toContain('--basis: 50%')
    expect(page.find('input[name="name"]').element.value).toBe('Chair')
    expect(page.find('input[name="price"]').element.value).toBe('120')
  })

  it('loads the item of the next id', async () => {
    const { admin, page } = await mountProductPage()
    await admin.navigate('/products/9')
    await settleForm()
    expect(page.find('input[name="name"]').element.value).toBe('Lamp')
  })

  it('has a submit button with the verbs of forms, but no cancel button', async () => {
    const { admin, page } = await mountProductPage()
    expect(getSubmitVerb(page)).toBe('Save')
    expect(page.find('.dito-button--cancel').exists()).toBe(false)
    await admin.navigate('/products')
    await settleForm()
    expect(getSubmitVerb(page)).toBe('Create')
  })

  it('edits, marks dirty and submits from a plain button', async () => {
    const { page, request, notify } = await mountProductPage()
    expect(form.isDirty).toBe(false)
    await enterValue(page.find('input[name="name"]'), 'Stool')
    expect(form.isDirty).toBe(true)
    await page.find('.publish').trigger('click')
    await settleForm()
    expect(getSentRequests(request)).toEqual([
      {
        method: 'patch',
        url: '/products/7',
        data: { id: 7, name: 'Stool', price: 120, notes: null }
      }
    ])
    expect(form.isDirty).toBe(false)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Successfully Saved' })
    )
  })

  it('submits with its own submit button', async () => {
    const { page, request } = await mountProductPage()
    await enterValue(page.find('input[name="price"]'), '99')
    await getSubmitButton(page).trigger('click')
    await settleForm()
    expect(getSentRequests(request)).toMatchObject([
      { method: 'patch', url: '/products/7', data: { price: 99 } }
    ])
  })

  it('sends relative requests to its resource', async () => {
    const { request } = await mountProductPage()
    await form.request({ method: 'post', resource: 'publish' })
    expect(getSentRequests(request)).toMatchObject([
      { method: 'post', url: '/products/7/publish' }
    ])
  })

  it('validates before submitting, and shows the errors', async () => {
    const { page, request } = await mountProductPage()
    await enterValue(page.find('input[name="name"]'), '')
    await page.find('.publish').trigger('click')
    await settleForm()
    expect(getSentRequests(request)).toEqual([])
    expect(page.find('.dito-errors').text()).toContain('required')
  })

  it('tells the errors of failed submits', async () => {
    const { page } = await mountProductPage()
    expect(form.getErrors()).toBe(null)
    await enterValue(page.find('input[name="name"]'), '')
    expect(await form.submit()).toBe(false)
    expect(form.getErrors()).toEqual({ name: [{ message: 'is required' }] })
  })

  it('tells the validation errors of the server', async () => {
    const { page, request } = await mountProductPage()
    const error = {
      message: 'must be unique',
      keyword: 'unique',
      params: { property: 'name' }
    }
    request.mockImplementationOnce(() => {
      throw new RequestError({
        status: 400,
        statusText: 'Bad Request',
        data: {
          type: 'ModelValidation',
          message: 'The provided data is not valid',
          errors: { name: [error] }
        }
      })
    })
    await enterValue(page.find('input[name="name"]'), 'Stool')
    expect(await form.submit()).toBe(false)
    expect(form.getErrors('name')).toEqual({ name: [error] })
  })

  it('creates without id, and saves the created item after', async () => {
    const { page, request } = await mountProductPage({ path: '/products' })
    await enterValue(page.find('input[name="name"]'), 'Table')
    await page.find('.publish').trigger('click')
    await settleForm()
    expect(getSubmitVerb(page)).toBe('Save')
    await enterValue(page.find('input[name="price"]'), '300')
    await page.find('.publish').trigger('click')
    await settleForm()
    expect(getSentRequests(request)).toMatchObject([
      { method: 'post', url: '/products', data: { name: 'Table' } },
      { method: 'patch', url: '/products/8', data: { price: 300 } }
    ])
  })

  it('creates items with the defaults of `api.defaults`', async () => {
    const { page } = await mountProductPage({
      path: '/products',
      api: { defaults: { number: { default: 1 } } }
    })
    expect(form.item).toMatchObject({ name: null, price: 1 })
    expect(page.find('input[name="price"]').element.value).toBe('1')
  })

  it('adds items to the lists of items that it creates', async () => {
    const error = vi.spyOn(console, 'error')
    const ListPage = {
      setup() {
        form = useDitoForm({
          resource: 'products',
          fields: {
            name: { type: 'text' },
            parts: {
              type: 'list',
              inlined: true,
              creatable: true,
              form: { type: 'form', fields: { title: { type: 'text' } } }
            }
          }
        })
        return () => h('div', { class: 'product-page' }, [h(DitoSchemaForm)])
      }
    }
    const { page } = await mountProductPage({
      path: '/parts',
      views: {
        parts: {
          type: 'page',
          label: 'Parts',
          path: 'parts',
          component: ListPage
        }
      }
    })
    await page.find('.dito-list tfoot .dito-button--add').trigger('click')
    await settleForm()
    expect(form.item.parts).toEqual([{ title: null }])
    expect(page.findAll('.dito-list tbody > .dito-table__row')).toHaveLength(1)
    expect(error).not.toHaveBeenCalled()
  })

  it('asks before leaving unsaved changes, also for other ids', async () => {
    const confirm = stubConfirm(false)
    const { admin, page } = await mountProductPage()
    await enterValue(page.find('input[name="name"]'), 'Stool')
    await admin.navigate('/books')
    expect(confirm).toHaveBeenCalledOnce()
    expect(admin.router.currentRoute.value.path).toBe('/products/7')
    await admin.navigate('/products/9')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(admin.router.currentRoute.value.path).toBe('/products/7')
    confirm.mockReturnValue(true)
    await admin.navigate('/books')
    expect(admin.router.currentRoute.value.path).toBe('/books')
  })

  it('waits for pending submits before leaving, without asking', async () => {
    const confirm = stubConfirm(false)
    const { admin, page, request } = await mountProductPage()
    const { promise, resolve } = Promise.withResolvers()
    request.mockImplementationOnce(() => promise)
    await enterValue(page.find('input[name="name"]'), 'Stool')
    await page.find('.publish').trigger('click')
    const navigation = admin.navigate('/books')
    await flushPromises()
    expect(admin.router.currentRoute.value.path).toBe('/products/7')
    resolve({ data: { id: 7, name: 'Stool', price: 120, notes: null } })
    await navigation
    expect(admin.router.currentRoute.value.path).toBe('/books')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('marks its route dirty in the trail and gives it its item label', async () => {
    const { page, admin } = await mountProductPage()
    const getTrailText = () => admin.wrapper.find('.dito-trail__text')
    expect(getTrailText().text()).toBe('Product')
    expect(getTrailText().classes()).not.toContain('dito-trail__text--dirty')
    expect(form.itemLabel).toBe('Chair')
    await enterValue(page.find('input[name="name"]'), 'Stool')
    expect(getTrailText().classes()).toContain('dito-trail__text--dirty')
    expect(form.itemLabel).toBe('Stool')
  })

  it('warns before unloading the page with unsaved changes', async () => {
    const { page } = await mountProductPage()
    expect(isUnloadPrevented()).toBe(false)
    await enterValue(page.find('input[name="name"]'), 'Stool')
    expect(isUnloadPrevented()).toBe(true)
  })

  it('lays out its fields in the slot of `DitoSchemaForm`', async () => {
    const { admin } = await mountProductPage({ path: '/layout' })
    await flushPromises()
    const layout = admin.wrapper.find('.layout')
    expect(layout.find('aside').text()).toBe('Preview')
    expect(layout.findAll('.dito-label').map(l => l.text())).toEqual([
      'Name',
      'Price',
      'Notes'
    ])
    expect(layout.find('input[name="name"]').element.value).toBe('Chair')
  })

  it('works in dialogs, without a guard', async () => {
    const confirm = stubConfirm(false)
    // Without declared props, the field's `schema` and `context` fall through
    // to `DitoSchemaForm`, which keeps the form's schema:
    const EditProduct = {
      setup() {
        form = useDitoForm({
          resource: 'products',
          id: 7,
          fields: { name: fields.name }
        })
        return () => h(DitoSchemaForm)
      }
    }
    const { admin, request } = await mountProductPage({ path: '/books' })
    const result = admin.context.showDialog({
      fields: { product: { type: 'component', component: EditProduct } }
    })
    await settleForm()
    const dialog = admin.wrapper.find('.dito-dialog')
    const input = dialog.find('input[name="name"]')
    expect(input.element.value).toBe('Chair')
    expect(dialog.find('.dito-button--cancel').exists()).toBe(true)
    await enterValue(input, 'Bench')
    expect(admin.context.ui.routes[0].isDirty).toBe(false)
    expect(isUnloadPrevented()).toBe(false)
    await getSubmitButton(dialog).trigger('click')
    await settleForm()
    expect(getSentRequests(request)).toMatchObject([
      { method: 'patch', url: '/products/7', data: { name: 'Bench' } }
    ])
    // The submit button closes the dialog with the saved item:
    await expect(result).resolves.toMatchObject({ id: 7, name: 'Bench' })
    expect(confirm).not.toHaveBeenCalled()
  })

  it(`doesn't submit on Enter in inputs, nor the dialog around it`, async () => {
    const EditProduct = {
      setup() {
        form = useDitoForm({
          resource: 'products',
          id: 7,
          fields: { name: fields.name }
        })
        return () => h(DitoSchemaForm)
      }
    }
    const { admin, request } = await mountProductPage({ path: '/books' })
    const result = vi.fn()
    admin.context
      .showDialog({
        fields: { product: { type: 'component', component: EditProduct } }
      })
      .then(result)
    await settleForm()
    const input = admin.wrapper.find('.dito-dialog input[name="name"]')
    await enterValue(input, 'Bench')
    await input.trigger('keydown', { key: 'Enter' })
    await settleForm()
    expect(getSentRequests(request)).toEqual([])
    expect(result).not.toHaveBeenCalled()
    expect(admin.wrapper.find('.dito-dialog').exists()).toBe(true)
    expect(form.item.name).toBe('Bench')
    expect(form.isDirty).toBe(true)
  })

  it('submits forms without a resource without a request', async () => {
    const onSuccess = vi.fn()
    const SettingsPage = {
      setup() {
        form = useDitoForm({ fields: { name: fields.name }, onSuccess })
        return () => h('div', { class: 'product-page' }, h(DitoSchemaForm))
      }
    }
    const { page, request, notify } = await mountProductPage({
      path: '/settings',
      views: {
        settings: { type: 'page', path: 'settings', component: SettingsPage }
      }
    })
    await enterValue(page.find('input[name="name"]'), 'Stool')
    expect(form.isDirty).toBe(true)
    expect(await form.submit()).toBe(true)
    expect(getSentRequests(request)).toEqual([])
    expect(form.isDirty).toBe(false)
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('DitoSchemaForm', () => {
  it('needs the form of `useDitoForm()`', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountProductPage({
      path: '/empty',
      views: {
        empty: {
          type: 'page',
          path: 'empty',
          component: { render: () => h(DitoSchemaForm) }
        }
      }
    }).catch(() => {})
    expect([...error.mock.calls, ...warn.mock.calls].flat()).toContainEqual(
      expect.objectContaining({
        message: 'Unable to render `DitoSchemaForm` without `useDitoForm()`.'
      })
    )
  })

  describe('with `properties`', () => {
    const properties = {
      name: { type: 'string', required: true, trim: true },
      price: { type: 'number', nullable: true, minimum: 0 },
      notes: { type: 'string', nullable: true },
      importName: { type: 'string', exclude: true }
    }

    // A page whose template lays out the data of its properties:
    const PropertiesPage = {
      setup() {
        const route = useRoute()
        form = useDitoForm({
          resource: 'products',
          id: () => route.params.id || null,
          properties
        })
        return () => h('div', { class: 'product-page' }, [h(DitoSchemaForm)])
      }
    }

    const mountPropertiesPage = path =>
      mountProductPage({
        path,
        views: {
          properties: {
            type: 'page',
            label: 'Properties',
            path: 'properties/:id?',
            component: PropertiesPage
          }
        }
      })

    it('creates items with the defaults of the properties', async () => {
      await mountPropertiesPage('/properties')
      expect(form.item).toEqual({
        name: '',
        price: null,
        notes: null,
        importName: ''
      })
    })

    it('validates and submits the data of the properties', async () => {
      const { request } = await mountPropertiesPage('/properties/7')
      expect(form.item).toMatchObject({ name: 'Chair', price: 120 })
      form.item.name = ''
      expect(await form.submit()).toBe(false)
      expect(form.getErrors()).toEqual({ name: [{ message: 'is required' }] })
      form.item.name = ' Stool '
      form.item.importName = 'stool'
      expect(await form.submit()).toBe(true)
      expect(getSentRequests(request)).toEqual([
        {
          method: 'patch',
          url: '/products/7',
          data: { id: 7, name: 'Stool', price: 120, notes: null }
        }
      ])
    })

    it('can not be combined with `fields`', () => {
      expect(() => useDitoForm({ fields, properties })).toThrow(
        'Unable to set up the form: It has both `fields` and `properties`.'
      )
    })
  })
})
