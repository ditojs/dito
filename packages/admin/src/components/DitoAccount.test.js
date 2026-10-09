import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'

describe('DitoAccount', () => {
  it('logs out through its menu', async () => {
    const admin = await mountAdmin({
      views: { test: { type: 'view', label: 'Test', components: {} } }
    })
    await flushPromises()
    const { session } = admin.root
    const logout = vi.spyOn(session, 'logout').mockResolvedValue()
    const account = admin.wrapper.find('.dito-account')
    const button = account.find('button[aria-haspopup="menu"]')
    expect(button.text()).toBe('tester')
    await button.trigger('click')
    const items = account.findAll('[role="menuitem"]')
    expect(items.map(item => item.text())).toEqual(['Settings', 'Logout'])
    await items[1].trigger('click')
    expect(logout).toHaveBeenCalledOnce()
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
