import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'
import { mountAdmin, mountForm } from '../test/mount.js'

describe('DitoTrail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const views = {
    books: { type: 'view', label: 'Books', components: {} }
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
    expect(push).toHaveBeenCalledWith({ path: '/books', force: true })
  })

  it('leaves modifier-clicks to the browser', async () => {
    const admin = await mountAdmin({ views })
    await admin.navigate('/books')
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
      expect(await clickTrailLink(admin, { [modifier]: true })).toBe(false)
    }
  })

  it('lists the route components by level when navigating', async () => {
    const { admin } = await mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            form: {
              type: 'form',
              label: 'Chapter',
              components: { title: { type: 'text' } }
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

  it(`doesn't list stale route components`, async () => {
    const admin = await mountAdmin({
      views: {
        ...views,
        authors: { type: 'view', label: 'Authors', components: {} }
      }
    })
    await admin.navigate('/books')
    // Replace the view with one that is never unmounted, as happens with
    // hot-reloading:
    appState.routeComponents[0] = { breadcrumb: 'Stale', path: '/stale' }
    await admin.navigate('/authors')
    const texts = admin.wrapper.findAll('.dito-trail__text')
    expect(texts.map(text => text.text())).toEqual(['Authors'])
  })
})
