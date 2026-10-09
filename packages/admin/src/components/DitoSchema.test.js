import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import DitoContext from '../DitoContext.js'
import { mountForm, mountSchema } from '../test/mount.js'

describe('DitoSchema', () => {
  it('passes the context to `schema.data()`', async () => {
    const data = vi.fn(() => ({ isPreviewing: false }))
    const { schemaComponent } = await mountForm({
      schema: {
        data,
        components: { title: { type: 'text' } }
      },
      data: { title: 'Emma' }
    })
    const [context] = data.mock.calls[0]
    expect(context).toBeInstanceOf(DitoContext)
    expect(context.item).toMatchObject({ title: 'Emma' })
    expect(schemaComponent.isPreviewing).toBe(false)
  })

  it('shares the width of inlined schemas with their components', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        components: {
          ingredients: {
            type: 'list',
            inlined: true,
            width: '1/2',
            form: {
              type: 'form',
              components: {
                name: { type: 'text', width: '1/2' },
                amount: { type: 'number', width: '1/4' }
              }
            }
          }
        }
      },
      data: { ingredients: [{ name: 'Flour', amount: 500 }] }
    })
    // Components that take a quarter of the page or less double their width
    // on narrow pages:
    const getMobileBasis = dataPath =>
      findContainer(dataPath).element.style.getPropertyValue('--basis-mobile')
    expect(getMobileBasis('ingredients/0/name')).toBe('100%')
    expect(getMobileBasis('ingredients/0/amount')).toBe('50%')
  })

  it('shows the panels of components in tabs with their tabs', async () => {
    const { wrapper, schemaComponent } = await mountSchema({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            components: {
              summary: {
                type: 'panel',
                label: 'Summary',
                components: { notes: { type: 'textarea' } }
              }
            }
          },
          history: {
            type: 'tab',
            components: { published: { type: 'text' } }
          }
        }
      },
      data: { notes: 'Classic', published: '1815' }
    })
    const isPanelVisible = () => {
      const panel = wrapper.find('.dito-sidebar .dito-panel')
      return panel.exists() && panel.element.style.display !== 'none'
    }
    expect(schemaComponent.selectedTab).toBe('details')
    expect(isPanelVisible()).toBe(true)
    // The components of the panel belong to the tab of the panel's component:
    const panel = wrapper.findComponent({ name: 'DitoPanel' })
    expect(panel.vm.tabComponent.tab).toBe('details')
    schemaComponent.selectedTab = 'history'
    await flushPromises()
    expect(isPanelVisible()).toBe(false)
    schemaComponent.selectedTab = 'details'
    await flushPromises()
    expect(isPanelVisible()).toBe(true)
  })

  it('shows the panels of inlined schemas in tabs with their tabs', async () => {
    const { wrapper, schemaComponent } = await mountSchema({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            components: {
              author: {
                type: 'object',
                inlined: true,
                form: {
                  type: 'form',
                  components: { name: { type: 'text' } },
                  panels: {
                    summary: {
                      type: 'panel',
                      label: 'Summary',
                      components: { notes: { type: 'textarea' } }
                    }
                  }
                }
              }
            }
          },
          history: {
            type: 'tab',
            components: { published: { type: 'text' } }
          }
        }
      },
      data: { author: { name: 'Jane', notes: 'Novelist' }, published: '1815' }
    })
    const isPanelVisible = () => {
      const panel = wrapper.find('.dito-sidebar .dito-panel')
      return panel.exists() && panel.element.style.display !== 'none'
    }
    expect(isPanelVisible()).toBe(true)
    schemaComponent.selectedTab = 'history'
    await flushPromises()
    expect(isPanelVisible()).toBe(false)
  })

  describe('validation errors', () => {
    async function mountRequiredTitle() {
      const result = await mountSchema({
        schema: {
          components: { title: { type: 'text', required: true } }
        }
      })
      return { ...result, input: result.findField('title').find('input') }
    }

    it('links the errors to their input for assistive technology', async () => {
      const { input, findContainer } = await mountRequiredTitle()
      expect(input.attributes('aria-invalid')).toBeUndefined()
      expect(input.attributes('aria-describedby')).toBeUndefined()
      await input.trigger('focus')
      await input.trigger('blur')
      const errors = findContainer('title').find('.dito-errors')
      expect(errors.attributes('role')).toBe('alert')
      expect(errors.attributes('id')).toBe('title-errors')
      expect(errors.text()).toBe('The title field is required.')
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.attributes('aria-describedby')).toBe('title-errors')
      await input.setValue('Dune')
      expect(findContainer('title').find('.dito-errors').exists()).toBe(false)
      expect(input.attributes('aria-invalid')).toBeUndefined()
      expect(input.attributes('aria-describedby')).toBeUndefined()
    })

    it('displays the errors in the document, not in tooltips', async () => {
      const { input, getErrors } = await mountRequiredTitle()
      for (let i = 0; i < 3; i++) {
        await input.trigger('focus')
        await input.trigger('blur')
      }
      expect(getErrors('title')).toEqual(['The title field is required.'])
      expect(document.querySelector('[data-tippy-root]')).toBe(null)
    })

    it('keeps the errors when focusing their input', async () => {
      const { input, getErrors } = await mountRequiredTitle()
      await input.trigger('focus')
      await input.trigger('blur')
      await input.trigger('focus')
      expect(getErrors('title')).toEqual(['The title field is required.'])
    })

    it('focuses the first invalid field on submit, with errors', async () => {
      const { submit, findField, getErrors } = await mountForm({
        schema: {
          components: {
            title: { type: 'text', required: true },
            author: { type: 'text', required: true }
          }
        },
        data: { title: 'Dune', author: '' }
      })
      expect(await submit()).toBe(null)
      expect(document.activeElement).toBe(
        findField('author').find('input').element
      )
      expect(getErrors('author')).toEqual(['The Author field is required.'])
    })
  })
})
