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

  describe('focus targets', () => {
    it('are native element refs themselves', async () => {
      const { getComponent, findField } = await mountSchema({
        schema: { components: { summary: { type: 'textarea' } } },
        data: { summary: 'A novel' }
      })
      const component = getComponent('summary')
      const textarea = findField('summary').element
      expect(textarea.tagName).toBe('TEXTAREA')
      expect(component.getFocusElement()).toBe(textarea)
      component.focusElement()
      expect(document.activeElement).toBe(textarea)
    })

    it('fall back to the root node without an element ref', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: { gap: { type: 'spacer' } }
        }
      })
      const component = getComponent('gap')
      const element = component.getFocusElement()
      expect(element).toBe(component.$el)
      // Root nodes that can't be focused, e.g. the spacer's, are skipped:
      expect(element.focus).toBe(undefined)
      expect(() => component.focusElement()).not.toThrow()
      expect(() => component.blurElement()).not.toThrow()
    })
  })

  describe('visible', () => {
    it('defaults to the visibility of the type', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            hiddenTitle: { type: 'text', visible: false },
            slug: { type: 'computed', compute: ({ item }) => item.title },
            shownSlug: {
              type: 'computed',
              visible: true,
              compute: ({ item }) => item.title
            }
          }
        },
        data: { title: 'Emma' }
      })
      expect(getComponent('title').visible).toBe(true)
      expect(getComponent('hiddenTitle').visible).toBe(false)
      expect(getComponent('slug').visible).toBe(false)
      expect(getComponent('shownSlug').visible).toBe(true)
    })
  })

  describe('validate()', () => {
    const mountRequiredTitle = title =>
      mountSchema({
        schema: {
          components: { title: { type: 'text', required: true } }
        },
        data: { title }
      })

    it('shows the errors until the value changes', async () => {
      const { getComponent, getErrors, settle } = await mountRequiredTitle(null)
      const component = getComponent('title')
      expect(component.validate()).toBe(false)
      await settle()
      expect(getErrors('title')).toEqual(['The title field is required.'])
      // E.g. a button that generates the value:
      component.value = 'Emma'
      await settle()
      expect(getErrors('title')).toEqual([])
    })

    it('keeps the errors of the server and of the field on blur', async () => {
      const { getComponent, getErrors, dataModel, settle } =
        await mountRequiredTitle('Emma')
      dataModel.replaceErrors(
        { title: [{ message: 'is taken' }] },
        { server: true }
      )
      dataModel.addError('title', 'Unable to load the titles.')
      const component = getComponent('title')
      await component.focus()
      component.blur()
      await settle()
      expect(getErrors('title')).toEqual([
        'The title field is taken.',
        'Unable to load the titles.'
      ])
    })

    it('shows the errors of the value right after it changed', async () => {
      const { getComponent, getErrors, settle } =
        await mountRequiredTitle('Emma')
      const component = getComponent('title')
      component.value = null
      expect(component.validate()).toBe(false)
      await settle()
      expect(getErrors('title')).toEqual(['The title field is required.'])
    })
  })
})
