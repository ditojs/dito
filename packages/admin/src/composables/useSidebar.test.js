import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'

// Sets the width that the media queries of the sidebars match against:
function setViewportWidth(width) {
  window.happyDOM.setViewport({ width })
}

async function mountMenu() {
  const admin = await mountAdmin({
    views: {
      books: {
        type: 'view',
        label: 'Books',
        components: { title: { type: 'text' } }
      },
      authors: {
        type: 'view',
        label: 'Authors',
        components: { name: { type: 'text' } }
      }
    }
  })
  await admin.navigate('/books')
  const { wrapper } = admin
  return {
    admin,
    navigation: wrapper.find('.dito-navigation'),
    button: wrapper.find('button[aria-controls="dito-navigation"]')
  }
}

async function mountSidebar() {
  const admin = await mountAdmin({
    views: {
      books: {
        type: 'view',
        label: 'Books',
        components: {
          title: { type: 'text' },
          summary: {
            type: 'panel',
            label: 'Summary',
            components: { notes: { type: 'textarea' } }
          }
        }
      },
      authors: {
        type: 'view',
        label: 'Authors',
        components: { name: { type: 'text' } }
      }
    }
  })
  await admin.navigate('/books')
  const { wrapper } = admin
  return {
    admin,
    sidebar: wrapper.find('.dito-sidebar'),
    region: wrapper.find('#dito-sidebar'),
    button: wrapper.find('button[aria-controls="dito-sidebar"]')
  }
}

function pressEscape(element) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  )
}

function pressPointer(element) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
}

describe('useSidebar()', () => {
  afterEach(() => {
    setViewportWidth(1024)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('on wide screens', () => {
    beforeEach(() => {
      setViewportWidth(1600)
    })

    it('docks the menu and the sidebar', async () => {
      const { navigation, button } = await mountMenu()
      expect(navigation.classes()).toContain('dito-navigation--docked')
      expect(button.attributes('aria-expanded')).toBe('true')
      const { sidebar } = await mountSidebar()
      expect(sidebar.classes()).toContain('dito-sidebar--docked')
    })

    it('collapses and docks the menu, and remembers it', async () => {
      const { navigation, button } = await mountMenu()
      await button.trigger('click')
      expect(navigation.classes()).toContain('dito-navigation--collapsed')
      expect(button.attributes('aria-expanded')).toBe('false')
      expect(localStorage.getItem('dito-menu-collapsed')).toBe('true')
      await button.trigger('click')
      expect(navigation.classes()).toContain('dito-navigation--docked')
      expect(localStorage.getItem('dito-menu-collapsed')).toBe('false')
    })

    it('collapses the sidebar separately from the menu', async () => {
      const { sidebar, button } = await mountSidebar()
      await button.trigger('click')
      expect(sidebar.classes()).toContain('dito-sidebar--collapsed')
      expect(localStorage.getItem('dito-sidebar-collapsed')).toBe('true')
      expect(localStorage.getItem('dito-menu-collapsed')).toBe(null)
    })

    it('restores the collapsed menu', async () => {
      localStorage.setItem('dito-menu-collapsed', 'true')
      const { navigation, button } = await mountMenu()
      expect(navigation.classes()).toContain('dito-navigation--collapsed')
      expect(button.attributes('aria-expanded')).toBe('false')
    })

    it('switches to the overlay and back with the screen width', async () => {
      const { navigation, button } = await mountMenu()
      setViewportWidth(640)
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--closed')
      await button.trigger('click')
      await flushPromises()
      setViewportWidth(1600)
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--docked')
      setViewportWidth(640)
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--closed')
    })

    it('docks and collapses without storage', async () => {
      // Storage throws when it's blocked, which happy-dom can't simulate:
      const throwSecurityError = () => {
        throw new DOMException('Storage is blocked', 'SecurityError')
      }
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
        throwSecurityError
      )
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
        throwSecurityError
      )
      const { navigation, button } = await mountMenu()
      expect(navigation.classes()).toContain('dito-navigation--docked')
      await button.trigger('click')
      expect(navigation.classes()).toContain('dito-navigation--collapsed')
    })
  })

  describe('on small screens', () => {
    beforeEach(() => {
      setViewportWidth(640)
    })

    it('opens the menu as an overlay, also when collapsed', async () => {
      localStorage.setItem('dito-menu-collapsed', 'true')
      const { navigation, button } = await mountMenu()
      expect(navigation.classes()).toContain('dito-navigation--closed')
      expect(button.attributes('aria-expanded')).toBe('false')
      await button.trigger('click')
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--open')
      expect(button.attributes('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(
        navigation.find('.dito-navigation__content').element
      )
      expect(localStorage.getItem('dito-menu-collapsed')).toBe('true')
    })

    it('closes the menu on Escape and focuses the button', async () => {
      const { navigation, button } = await mountMenu()
      await button.trigger('click')
      await flushPromises()
      pressEscape(document.activeElement)
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--closed')
      expect(document.activeElement).toBe(button.element)
    })

    it('closes the menu on clicks outside of it', async () => {
      const { admin, navigation, button } = await mountMenu()
      await button.trigger('click')
      await flushPromises()
      pressPointer(navigation.find('.dito-menu').element)
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--open')
      pressPointer(admin.wrapper.find('.dito-page input').element)
      await flushPromises()
      expect(navigation.classes()).toContain('dito-navigation--closed')
    })

    it('closes the menu on navigation', async () => {
      const { admin, navigation, button } = await mountMenu()
      await button.trigger('click')
      await flushPromises()
      const link = navigation
        .findAll('.dito-menu__link')
        .find(link => link.text() === 'Authors')
      link.element.focus()
      await link.trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/authors')
      expect(navigation.classes()).toContain('dito-navigation--closed')
      expect(document.activeElement).toBe(button.element)
    })

    it('opens the sidebar with its panels as an overlay', async () => {
      const { sidebar, region, button } = await mountSidebar()
      expect(sidebar.classes()).toContain('dito-sidebar--closed')
      expect(region.find('.dito-panel').exists()).toBe(true)
      await button.trigger('click')
      await flushPromises()
      expect(sidebar.classes()).toContain('dito-sidebar--open')
      expect(button.attributes('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(region.element)
      await button.trigger('click')
      expect(sidebar.classes()).toContain('dito-sidebar--closed')
      expect(document.activeElement).toBe(button.element)
    })

    it('closes the sidebar on Escape and clicks outside', async () => {
      const { admin, sidebar, button } = await mountSidebar()
      await button.trigger('click')
      await flushPromises()
      pressEscape(document.activeElement)
      await flushPromises()
      expect(sidebar.classes()).toContain('dito-sidebar--closed')
      await button.trigger('click')
      await flushPromises()
      pressPointer(admin.wrapper.find('.dito-page input').element)
      await flushPromises()
      expect(sidebar.classes()).toContain('dito-sidebar--closed')
    })

    it('closes the sidebar on navigation', async () => {
      const { admin, sidebar, button } = await mountSidebar()
      await button.trigger('click')
      await flushPromises()
      await admin.navigate('/authors')
      expect(sidebar.classes()).toContain('dito-sidebar--closed')
    })

    it(`doesn't close on Escape keys that others handled`, async () => {
      const { sidebar, button } = await mountSidebar()
      await button.trigger('click')
      await flushPromises()
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      })
      event.preventDefault()
      document.activeElement.dispatchEvent(event)
      await flushPromises()
      expect(sidebar.classes()).toContain('dito-sidebar--open')
    })
  })
})
