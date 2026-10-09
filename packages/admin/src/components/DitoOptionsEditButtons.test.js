import { afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { mountAdmin, settle } from '../test/mount.js'
import DitoOptionsEditButtons from './DitoOptionsEditButtons.vue'

// Mounts the edit buttons on their own, in an admin with a `genres` view that
// the options are edited in, and with the context of the view of the options.
async function mountOptionsEditButtons(props) {
  const admin = await mountAdmin({
    views: {
      genres: {
        type: 'view',
        component: {
          type: 'list',
          resource: { path: 'genres' },
          form: { type: 'form', components: { name: { type: 'text' } } }
        }
      },
      test: { type: 'view', label: 'Test', components: {} }
    }
  })
  await admin.navigate('/test')
  const view = admin.getRouteComponent(component => component.isView)
  await settle(view)
  return mount(DitoOptionsEditButtons, {
    props: {
      schema: { type: 'select', view: 'genres' },
      dataPath: 'genre',
      data: {},
      meta: {},
      store: {},
      parentContext: view.context,
      ...props
    },
    global: {
      plugins: [admin.router],
      provide: getProvides(admin.root)
    }
  })
}

// Returns all values that `component` provides to its descendants, including
// the inherited ones, for the edit buttons to inject.
function getProvides(component) {
  const provides = {}
  for (const key in component.$.provides) {
    provides[key] = component.$.provides[key]
  }
  return provides
}

describe('DitoOptionsEditButtons', () => {
  enableAutoUnmount(afterEach)

  it(`links to the form of the option in the options' view`, async () => {
    const wrapper = await mountOptionsEditButtons({ optionValue: 2 })
    const link = wrapper.find('a.dito-button--edit')
    expect(link.attributes('href')).toBe('/genres/2')
    expect(link.attributes('aria-disabled')).toBeUndefined()
  })

  it('disables the link without an option value', async () => {
    const wrapper = await mountOptionsEditButtons({ optionValue: null })
    const link = wrapper.find('a.dito-button--edit')
    expect(link.attributes('aria-disabled')).toBe('true')
  })
})
