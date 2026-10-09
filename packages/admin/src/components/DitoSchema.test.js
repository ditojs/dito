import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import DitoContext from '../DitoContext.js'
import appState from '../appState.js'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle
} from '../test/mount.js'

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

  it('selects the tab of panel components on validation errors', async () => {
    const { admin, submit, schemaComponent, getErrors } = await mountForm({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            components: { title: { type: 'text' } }
          },
          history: {
            type: 'tab',
            components: {
              summary: {
                type: 'panel',
                label: 'Summary',
                components: { notes: { type: 'text', required: true } }
              }
            }
          }
        }
      },
      data: { title: 'Emma', notes: '' }
    })
    expect(schemaComponent.selectedTab).toBe('details')
    expect(await submit()).toBe(null)
    expect(getErrors('notes')).toEqual(['The Notes field is required.'])
    expect(admin.router.currentRoute.value.hash).toBe('#history')
    expect(schemaComponent.selectedTab).toBe('history')
  })

  it('selects the tab of inlined schema panels on errors', async () => {
    const { admin, submit, schemaComponent } = await mountForm({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            components: { title: { type: 'text' } }
          },
          history: {
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
                      components: { notes: { type: 'text', required: true } }
                    }
                  }
                }
              }
            }
          }
        }
      },
      data: { title: 'Emma', author: { name: 'Jane', notes: '' } }
    })
    expect(await submit()).toBe(null)
    expect(admin.router.currentRoute.value.hash).toBe('#history')
    expect(schemaComponent.selectedTab).toBe('history')
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

  it('is its own schema component, not the one of its parent', async () => {
    const { wrapper, schemaComponent, getComponent } = await mountSchema({
      schema: {
        components: {
          author: {
            type: 'object',
            inlined: true,
            form: { type: 'form', components: { name: { type: 'text' } } }
          }
        }
      },
      data: { author: { name: 'Jane' } }
    })
    expect(schemaComponent.schemaComponent).toBe(schemaComponent)
    const nested = wrapper
      .findAllComponents({ name: 'DitoSchema' })
      .map(({ vm }) => vm)
      .find(vm => vm !== schemaComponent)
    expect(nested.schemaComponent).toBe(nested)
    expect(getComponent('author/name').schemaComponent).toBe(nested)
    expect(getComponent('author').schemaComponent).toBe(schemaComponent)
  })

  describe('tabs', () => {
    const createTabs = defaultTab => ({
      details: { type: 'tab', components: { title: { type: 'text' } } },
      reviews: {
        type: 'tab',
        defaultTab,
        components: { rating: { type: 'number' } }
      }
    })

    it('selects the first tab without a `defaultTab`', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { tabs: createTabs(false) },
        data: { title: 'Emma', rating: 5 }
      })
      expect(schemaComponent.selectedTab).toBe('details')
    })

    it('selects the tab with `defaultTab: true`', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { tabs: createTabs(true) },
        data: { title: 'Emma', rating: 5 }
      })
      expect(schemaComponent.selectedTab).toBe('reviews')
    })

    it('selects the tab whose `defaultTab()` returns true', async () => {
      const defaultTab = vi.fn(({ user }) => user.username === 'tester')
      const { schemaComponent } = await mountForm({
        schema: { tabs: createTabs(defaultTab) },
        data: { title: 'Emma', rating: 5 }
      })
      expect(schemaComponent.selectedTab).toBe('reviews')
      expect(defaultTab).toHaveBeenCalledWith(expect.any(DitoContext))
    })

    // `defaultTab()` is first evaluated before the form's data is loaded, with
    // `item: null`, and is followed once the data is there.
    it('selects the default tab of the loaded item', async () => {
      const { schemaComponent, admin } = await mountForm({
        schema: { tabs: createTabs(({ item }) => item?.rating > 3) },
        data: { title: 'Emma', rating: 5 }
      })
      expect(schemaComponent.selectedTab).toBe('reviews')
      expect(admin.router.currentRoute.value.hash).toBe('#reviews')
    })

    it('keeps the default tab when the loaded data changes', async () => {
      const { schemaComponent, data, settle } = await mountForm({
        schema: { tabs: createTabs(({ item }) => item?.rating > 3) },
        data: { title: 'Emma', rating: 5 }
      })
      data.rating = 2
      await settle()
      expect(schemaComponent.selectedTab).toBe('reviews')
    })

    describe('while the item loads', () => {
      // Mounts a form whose item loads once `loadItem()` is called, with a
      // `defaultTab()` that selects 'reviews' for the loaded item.
      async function mountLoadingForm(path) {
        let loadItem
        const admin = await mountAdmin({
          views: {
            items: {
              type: 'view',
              component: {
                type: 'list',
                resource: { path: 'items' },
                form: {
                  type: 'form',
                  tabs: createTabs(({ item }) => item?.rating > 3)
                }
              }
            }
          },
          request: ({ url }) =>
            url === '/items/1'
              ? new Promise(resolve => {
                  loadItem = () => resolve({ data: { id: 1, rating: 5 } })
                })
              : { data: [] }
        })
        await admin.navigate(path)
        const form = admin.getRouteComponent(component => component.isForm)
        return {
          admin,
          schemaComponent: form.mainSchemaComponent,
          async loadItem() {
            loadItem()
            await settle(form)
          }
        }
      }

      it('selects the default tab of the loaded item', async () => {
        const { admin, schemaComponent, loadItem } =
          await mountLoadingForm('/items/1')
        // The hash that follows the selection isn't a selection by the route:
        expect(admin.router.currentRoute.value.hash).toBe('#details')
        await loadItem()
        expect(schemaComponent.selectedTab).toBe('reviews')
      })

      it('keeps the tab selected by the user', async () => {
        const { admin, schemaComponent, loadItem } =
          await mountLoadingForm('/items/1')
        admin.element.querySelector('.dito-tabs__link').click()
        await loadItem()
        expect(schemaComponent.selectedTab).toBe('details')
      })

      it('keeps the tab selected by the route', async () => {
        const { schemaComponent, loadItem } =
          await mountLoadingForm('/items/1#details')
        await loadItem()
        expect(schemaComponent.selectedTab).toBe('details')
      })
    })
  })

  it('makes the page wide while a `wide` view is shown', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          label: 'Books',
          wide: true,
          components: { title: { type: 'text' } }
        },
        authors: {
          type: 'view',
          label: 'Authors',
          components: { name: { type: 'text' } }
        }
      }
    })
    const page = () => admin.element.querySelector('main.dito-page')
    await admin.navigate('/books')
    expect(appState.pageClass).toBe('dito-page--wide')
    expect(page().classList.contains('dito-page--wide')).toBe(true)
    await admin.navigate('/authors')
    expect(appState.pageClass).toBe(null)
    expect(page().classList.contains('dito-page--wide')).toBe(false)
  })

  it('verifies matching data silently with `verifyAll()`', async () => {
    const { schemaComponent, getErrors } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text', required: true },
          author: { type: 'text', required: true }
        }
      },
      data: { title: 'Emma', author: '' }
    })
    expect(schemaComponent.verifyAll()).toBe(false)
    expect(schemaComponent.verifyAll('title')).toBe(true)
    expect(schemaComponent.verifyAll(/^author$/)).toBe(false)
    // Unlike `validateAll()`, no errors are shown:
    expect(getErrors('author')).toEqual([])
    expect(schemaComponent.validateAll('author')).toBe(false)
    await flushPromises()
    expect(getErrors('author')).toEqual(['The author field is required.'])
  })

  describe('navigateToComponent()', () => {
    async function mountCollapsedSection() {
      const result = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            details: {
              type: 'section',
              collapsible: true,
              collapsed: true,
              components: { notes: { type: 'textarea' } }
            }
          }
        },
        data: { title: 'Emma', notes: 'Classic' }
      })
      const section = result.wrapper
        .findAllComponents({ name: 'DitoSchema' })
        .map(({ vm }) => vm)
        .find(vm => vm !== result.schemaComponent)
      return { ...result, section }
    }

    it('opens collapsed schemas to reveal the component', async () => {
      const { section } = await mountCollapsedSection()
      expect(section.opened).toBe(false)
      const onComplete = vi.fn(() => true)
      expect(await section.navigateToComponent('notes', onComplete)).toBe(true)
      expect(section.opened).toBe(true)
      expect(onComplete).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'notes' })
      ])
    })

    it('keeps collapsed schemas closed without a component', async () => {
      const { section } = await mountCollapsedSection()
      expect(await section.navigateToComponent('isbn')).toBe(false)
      expect(section.opened).toBe(false)
    })
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
