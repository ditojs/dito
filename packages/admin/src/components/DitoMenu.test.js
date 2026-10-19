import { flushPromises } from '@vue/test-utils'
import { mountAdmin, isForm } from '../test/mount.js'

describe('DitoMenu', () => {
  const views = {
    'books': { type: 'view', label: 'Books', fields: {} },
    'books-archive': {
      type: 'view',
      label: 'Archive',
      fields: {}
    }
  }

  const getActiveLabels = admin =>
    admin.wrapper
      .findAll('.dito-menu__link--active')
      .map(link => link.text())

  it('marks the item of the current view as active', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    expect(getActiveLabels(admin)).toEqual(['Books'])
  })

  it(`doesn't mark items that only share a prefix as active`, async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books-archive')
    expect(getActiveLabels(admin)).toEqual(['Archive'])
  })
})

describe('DitoMenu links', () => {
  const views = {
    books: { type: 'view', label: 'Books', fields: {} },
    catalog: {
      type: 'menu',
      label: 'Catalog',
      items: {
        authors: { type: 'view', label: 'Authors', fields: {} },
        series: { type: 'view', label: 'Series', fields: {} }
      }
    }
  }

  // Dispatches a click on the menu link with `label`, like the browser does,
  // and returns whether the default action was prevented.
  async function clickLink(admin, label, options = {}) {
    const link = admin.wrapper
      .findAll('.dito-menu__link')
      .find(link => link.text() === label)
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ...options
    })
    link.element.dispatchEvent(event)
    await flushPromises()
    return event.defaultPrevented
  }

  it('opens the forms of objects that are the component of views', async () => {
    const admin = await mountAdmin({
      views: {
        ...views,
        generator: {
          type: 'view',
          label: 'Generator',
          field: {
            type: 'object',
            resource: { path: 'generator' },
            form: { type: 'form', fields: { name: { type: 'text' } } }
          }
        }
      },
      request: () => ({ data: {} })
    })
    await admin.navigate('/books')
    expect(await clickLink(admin, 'Generator')).toBe(true)
    expect(admin.router.currentRoute.value.path).toBe('/generator')
    expect(admin.getRouteComponent(isForm)).toBeTruthy()
  })

  it('links menus to their first item', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    const link = admin.wrapper
      .findAll('.dito-menu__link')
      .find(link => link.text() === 'Catalog')
    expect(link.attributes('href')).toBe('/catalog/authors')
  })

  it('navigates on click', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    expect(await clickLink(admin, 'Catalog')).toBe(true)
    expect(admin.router.currentRoute.value.path).toBe('/catalog/authors')
  })

  it('leaves modifier-clicks to the browser', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
      expect(await clickLink(admin, 'Series', { [modifier]: true })).toBe(
        false
      )
    }
    expect(admin.router.currentRoute.value.path).toBe('/books')
  })
})
