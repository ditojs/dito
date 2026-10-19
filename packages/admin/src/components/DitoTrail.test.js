import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, mountForm } from '../test/mount.js'

describe('DitoTrail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const views = {
    books: { type: 'view', label: 'Books', fields: {} }
  }

  // Dispatches a click on the first trail link, like the browser does, and
  // returns whether the default action was prevented.
  async function clickTrailLink(admin, options = {}) {
    const link = admin.wrapper.find('.dito-trail__link')
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ...options
    })
    link.element.dispatchEvent(event)
    await flushPromises()
    return event.defaultPrevented
  }

  it('links to the route of the component', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    const link = admin.wrapper.find('.dito-trail__link')
    expect(link.attributes('href')).toBe('/books')
    expect(link.attributes('aria-current')).toBe('page')
  })

  it('navigates on click', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    const push = vi.spyOn(admin.router, 'push')
    expect(await clickTrailLink(admin)).toBe(true)
    // `force` reloads the view even though it is the current route.
    const [[location]] = push.mock.calls
    expect(location.force).toBe(true)
    expect(admin.router.resolve(location).path).toBe('/books')
  })

  it('leaves modifier-clicks to the browser', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
      expect(await clickTrailLink(admin, { [modifier]: true })).toBe(false)
    }
  })

  it('lists the routes by level when navigating', async () => {
    const { admin } = await mountForm({
      schema: {
        fields: {
          chapters: {
            type: 'list',
            form: {
              type: 'form',
              label: 'Chapter',
              fields: { title: { type: 'text' } }
            }
          }
        }
      },
      data: { chapters: [{ title: 'Arrakis' }, { title: 'Caladan' }] }
    })
    const getTrail = () =>
      admin.wrapper.findAll('.dito-trail__text').map(text => text.text())
    const trail = getTrail()
    expect(trail).toHaveLength(2)
    await admin.navigate('/items/1/chapters/0')
    expect(getTrail()).toEqual([...trail, 'Edit Chapter'])
    await admin.navigate('/items')
    expect(getTrail()).toEqual(trail.slice(0, 1))
    await admin.navigate('/items/1/chapters/1')
    expect(getTrail()).toEqual([...trail, 'Edit Chapter'])
    await admin.navigate('/items/1')
    expect(getTrail()).toEqual(trail)
  })

  it('shows the labels of views as text', async () => {
    const admin = await mountAdmin({
      views: {
        books: { type: 'view', label: 'Books & <i>Films</i>', fields: {} }
      }
    })
    await admin.navigate('/books')
    const trail = admin.wrapper.find('.dito-trail')
    expect(trail.find('.dito-trail__text').text()).toBe('Books & <i>Films</i>')
    expect(trail.find('i').exists()).toBe(false)
  })

  it('shows the text of `{ html }` form labels', async () => {
    const { admin } = await mountForm({
      schema: {
        fields: {
          chapters: {
            type: 'list',
            form: {
              type: 'form',
              label: { html: '<b>Chapter</b>' },
              fields: { title: { type: 'text' } }
            }
          }
        }
      },
      data: { chapters: [{ title: 'Arrakis' }] }
    })
    await admin.navigate('/items/1/chapters/0')
    const texts = admin.wrapper.findAll('.dito-trail__text')
    expect(texts.at(-1).text()).toBe('Edit Chapter')
  })
})
