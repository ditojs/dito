import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'

describe('TypeMixin', () => {
  describe('focus() and blur()', () => {
    it('target the input of input components', async () => {
      const { getComponent, findField } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      const component = getComponent('title')
      const input = findField('title').find('input').element
      await component.focus()
      await flushPromises()
      expect(document.activeElement).toBe(input)
      expect(component.focused).toBe(true)
      component.blur()
      await flushPromises()
      expect(document.activeElement).not.toBe(input)
      expect(component.focused).toBe(false)
    })
  })
})
