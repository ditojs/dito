import { vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { trackRegistration } from './registration.js'

describe('trackRegistration()', () => {
  function mountRegistrant(componentPath) {
    const register = vi.fn()
    const Registrant = {
      props: { componentPath: { type: String, required: true } },
      created() {
        this.unregister = trackRegistration(this, register)
      },
      unmounted() {
        this.unregister()
      },
      render: () => null
    }
    const wrapper = mount(Registrant, { props: { componentPath } })
    return { wrapper, register }
  }

  it('registers the component under its component path', () => {
    const { register } = mountRegistrant('books/0')
    expect(register.mock.calls).toEqual([[true, 'books/0']])
  })

  it('registers the component again when its component path changes', async () => {
    const { wrapper, register } = mountRegistrant('books/0')
    await wrapper.setProps({ componentPath: 'books/1' })
    await nextTick()
    expect(register.mock.calls).toEqual([
      [true, 'books/0'],
      [false, 'books/0'],
      [true, 'books/1']
    ])
  })

  it('unregisters the component under its last component path', async () => {
    const { wrapper, register } = mountRegistrant('books/0')
    await wrapper.setProps({ componentPath: 'books/1' })
    register.mockClear()
    wrapper.unmount()
    expect(register.mock.calls).toEqual([[false, 'books/1']])
  })

  it('stops watching the component path once unregistered', async () => {
    const { wrapper, register } = mountRegistrant('books/0')
    wrapper.vm.unregister()
    register.mockClear()
    await wrapper.setProps({ componentPath: 'books/1' })
    expect(register).not.toHaveBeenCalled()
  })
})
