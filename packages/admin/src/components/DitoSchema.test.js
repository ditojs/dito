import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import SchemaContext from '../SchemaContext.js'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  enterValue,
  isForm
} from '../test/mount.js'
import DitoSchema from './DitoSchema.vue'

describe('DitoSchema', () => {
  it('shares the width of inlined schemas with their components', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        fields: {
          ingredients: {
            type: 'list',
            inlined: true,
            width: '1/2',
            form: {
              type: 'form',
              fields: {
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
            fields: {
              summary: {
                type: 'panel',
                label: 'Summary',
                fields: { notes: { type: 'textarea' } }
              }
            }
          },
          history: {
            type: 'tab',
            fields: { published: { type: 'text' } }
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
            fields: { title: { type: 'text' } }
          },
          history: {
            type: 'tab',
            fields: {
              summary: {
                type: 'panel',
                label: 'Summary',
                fields: { notes: { type: 'text', required: true } }
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
    expect(admin.router.currentRoute.value.path).toBe('/items/1/history')
    expect(schemaComponent.selectedTab).toBe('history')
  })

  it('selects the tab of inlined schema panels on errors', async () => {
    const { admin, submit, schemaComponent } = await mountForm({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            fields: { title: { type: 'text' } }
          },
          history: {
            type: 'tab',
            fields: {
              author: {
                type: 'object',
                inlined: true,
                form: {
                  type: 'form',
                  fields: { name: { type: 'text' } },
                  panels: {
                    summary: {
                      type: 'panel',
                      label: 'Summary',
                      fields: { notes: { type: 'text', required: true } }
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
    expect(admin.router.currentRoute.value.path).toBe('/items/1/history')
    expect(schemaComponent.selectedTab).toBe('history')
  })

  it('shows the panels of inlined schemas in tabs with their tabs', async () => {
    const { wrapper, schemaComponent } = await mountSchema({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            fields: {
              author: {
                type: 'object',
                inlined: true,
                form: {
                  type: 'form',
                  fields: { name: { type: 'text' } },
                  panels: {
                    summary: {
                      type: 'panel',
                      label: 'Summary',
                      fields: { notes: { type: 'textarea' } }
                    }
                  }
                }
              }
            }
          },
          history: {
            type: 'tab',
            fields: { published: { type: 'text' } }
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

  describe('tabs', () => {
    const createTabs = defaultTab => ({
      details: { type: 'tab', fields: { title: { type: 'text' } } },
      reviews: {
        type: 'tab',
        defaultTab,
        fields: { rating: { type: 'number' } }
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
      expect(defaultTab).toHaveBeenCalledWith(expect.any(SchemaContext))
    })

    // `defaultTab()` is first evaluated before the form's data is loaded, with
    // `item: null`, and is followed once the data is there.
    it('selects the default tab of the loaded item', async () => {
      const { schemaComponent, admin } = await mountForm({
        schema: { tabs: createTabs(({ item }) => item?.rating > 3) },
        data: { title: 'Emma', rating: 5 }
      })
      expect(schemaComponent.selectedTab).toBe('reviews')
      expect(admin.router.currentRoute.value.path).toBe('/items/1/reviews')
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
              field: {
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
        const form = admin.getRouteComponent(isForm)
        return {
          admin,
          routeComponent: form,
          schemaComponent: admin.getSchemaComponent(form),
          async loadItem() {
            loadItem()
            await settle(form)
          }
        }
      }

      it('selects the default tab of the loaded item', async () => {
        const { admin, schemaComponent, loadItem } =
          await mountLoadingForm('/items/1')
        // The path that follows the selection isn't a selection by the route:
        expect(admin.router.currentRoute.value.path).toBe('/items/1/details')
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

      it('selects the tab of the route before the form is mounted', async () => {
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { schemaComponent, loadItem } =
          await mountLoadingForm('/items/1/details')
        await loadItem()
        expect(schemaComponent.selectedTab).toBe('details')
        expect(logError).not.toHaveBeenCalled()
        logError.mockRestore()
      })

      it('validates nothing before the item is loaded', async () => {
        const { routeComponent, schemaComponent, loadItem } =
          await mountLoadingForm('/items/1')
        expect(schemaComponent.hasData).toBe(false)
        expect(routeComponent.dataContext.verify()).toBe(true)
        await loadItem()
        expect(schemaComponent.hasData).toBe(true)
      })

      it('keeps the tab selected by the route', async () => {
        const { schemaComponent, loadItem } =
          await mountLoadingForm('/items/1/details')
        await loadItem()
        expect(schemaComponent.selectedTab).toBe('details')
      })
    })

    describe('in the path', () => {
      const schema = { tabs: createTabs(false) }
      const data = { title: 'Emma', rating: 5 }

      it('names the default tab', async () => {
        const { admin, schemaComponent } = await mountForm({ schema, data })
        expect(schemaComponent.selectedTab).toBe('details')
        expect(admin.router.currentRoute.value.path).toBe('/items/1/details')
      })

      it('selects the tab that the path names', async () => {
        const { admin, schemaComponent } = await mountForm({ schema, data })
        await admin.navigate('/items/1/reviews')
        expect(schemaComponent.selectedTab).toBe('reviews')
      })

      it('selects the tab that the path names on reload', async () => {
        const { admin, schemaComponent } = await mountForm({
          schema,
          data,
          path: '/items/1/reviews'
        })
        expect(schemaComponent.selectedTab).toBe('reviews')
        expect(admin.router.currentRoute.value.path).toBe('/items/1/reviews')
      })

      it('replaces the path with the clicked tab', async () => {
        const { admin } = await mountForm({ schema, data })
        const { length } = window.history
        admin.element.querySelectorAll('.dito-tabs__link')[1].click()
        await flushPromises()
        expect(admin.router.currentRoute.value.path).toBe('/items/1/reviews')
        expect(window.history.length).toBe(length)
      })

      it('names the selected tab when the path leaves it out', async () => {
        const { admin, schemaComponent } = await mountForm({
          schema,
          data,
          path: '/items/1/reviews'
        })
        await admin.navigate('/items/1')
        expect(schemaComponent.selectedTab).toBe('reviews')
        expect(admin.router.currentRoute.value.path).toBe('/items/1/reviews')
      })

      // Tabs and the sources of the form share the names in the path:
      it('selects the tab over a source of the same name', async () => {
        const { admin, schemaComponent } = await mountForm({
          schema: {
            fields: {
              reviews: {
                type: 'object',
                form: { type: 'form', fields: { text: { type: 'text' } } }
              }
            },
            tabs: createTabs(false)
          },
          data: { ...data, reviews: { text: 'Witty' } }
        })
        await admin.navigate('/items/1/reviews')
        expect(schemaComponent.selectedTab).toBe('reviews')
        expect(admin.getRouteComponents(isForm)).toHaveLength(1)
      })
    })

    it('renders tabs once they are selected, and keeps them', async () => {
      const { wrapper, schemaComponent } = await mountSchema({
        schema: { tabs: createTabs(false) },
        data: { title: 'Emma', rating: 5 }
      })
      const hasRating = () => wrapper.find('input[name="rating"]').exists()
      expect(hasRating()).toBe(false)
      schemaComponent.selectTab('reviews')
      await flushPromises()
      expect(hasRating()).toBe(true)
      schemaComponent.selectTab('details')
      await flushPromises()
      expect(hasRating()).toBe(true)
    })

    it('reveals the errors of tabs that were not selected', async () => {
      const { admin, submit, getErrors, schemaComponent } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', fields: { title: { type: 'text' } } },
            reviews: {
              type: 'tab',
              fields: { rating: { type: 'number', required: true } }
            }
          }
        },
        data: { title: 'Emma', rating: null }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      expect(schemaComponent.selectedTab).toBe('details')
      expect(await submit()).toBe(null)
      expect(schemaComponent.selectedTab).toBe('reviews')
      expect(getErrors('rating')).toEqual(['The Rating field is required.'])
      expect(document.activeElement.name).toBe('rating')
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Please correct the highlighted errors.'
        })
      )
      notify.mockRestore()
    })
  })

  // ditojs/dito#192: The forms of the items of trees and lists in tabs are
  // nested routes below the path of the parent's tab.
  describe('tabs with forms of nested routes', () => {
    const pageForm = { type: 'form', fields: { title: { type: 'text' } } }

    it.each([
      ['tree-list', { type: 'tree-list', editable: true }],
      ['list', { type: 'list', editable: true }]
    ])('keeps the tab of a %s after closing its form', async (_, source) => {
      const { admin, schemaComponent, wrapper } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', fields: { title: { type: 'text' } } },
            planning: {
              type: 'tab',
              fields: {
                pages: { ...source, path: 'pages', form: pageForm }
              }
            }
          }
        },
        data: { title: 'Site', pages: [{ title: 'About' }] }
      })
      await admin.navigate('/items/1/planning')
      await wrapper.find('.dito-button--edit').trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/planning/pages/0'
      )
      expect(schemaComponent.selectedTab).toBe('planning')
      const pageFormComponent =
        admin.getRouteComponent(
          isForm
        )
      await pageFormComponent.routeContext.close()
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/planning')
      expect(schemaComponent.selectedTab).toBe('planning')
    })

    // Mounts an item form with the tabs `details` and `planning`, the latter
    // holding a tree list whose forms have the tabs `pageTabs`, opens the
    // form of its page and counts the route's replacements, stopping them
    // after a few so that loops between the forms end.
    async function openTabbedPageForm(pageTabs) {
      const tabs = Object.fromEntries(
        pageTabs.map(name => [
          name,
          { type: 'tab', fields: { [name]: { type: 'text' } } }
        ])
      )
      const { admin, schemaComponent, wrapper } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', fields: { title: { type: 'text' } } },
            planning: {
              type: 'tab',
              fields: {
                pages: {
                  type: 'tree-list',
                  editable: true,
                  path: 'pages',
                  form: { type: 'form', tabs }
                }
              }
            }
          }
        },
        data: { title: 'Site', pages: [{ title: 'About' }] }
      })
      await admin.navigate('/items/1/planning')
      const { router } = admin
      const replace = router.replace.bind(router)
      let replaceCount = 0
      router.replace = to => (++replaceCount <= 10 ? replace(to) : undefined)
      await wrapper.find('.dito-button--edit').trigger('click')
      await flushPromises()
      const [, pageForm] = admin.getRouteComponents(isForm)
      return {
        admin,
        schemaComponent,
        pageSchemaComponent: admin.getSchemaComponent(pageForm),
        getReplaceCount: () => replaceCount
      }
    }

    it('follows the route with the tabs of the form of a tree item', async () => {
      const { admin, schemaComponent, pageSchemaComponent, getReplaceCount } =
        await openTabbedPageForm(['content', 'text'])
      expect(getReplaceCount()).toBeLessThanOrEqual(1)
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/planning/pages/0/content'
      )
      expect(schemaComponent.selectedTab).toBe('planning')
      expect(pageSchemaComponent.selectedTab).toBe('content')
      await admin.navigate('/items/1/planning/pages/0/text')
      expect(pageSchemaComponent.selectedTab).toBe('text')
      expect(schemaComponent.selectedTab).toBe('planning')
    })

    it('keeps the tab of a form whose tab names its items use', async () => {
      const { admin, schemaComponent, pageSchemaComponent, getReplaceCount } =
        await openTabbedPageForm(['content', 'details'])
      expect(getReplaceCount()).toBeLessThanOrEqual(1)
      expect(schemaComponent.selectedTab).toBe('planning')
      expect(pageSchemaComponent.selectedTab).toBe('content')
      await admin.navigate('/items/1/planning/pages/0/details')
      expect(pageSchemaComponent.selectedTab).toBe('details')
      expect(schemaComponent.selectedTab).toBe('planning')
    })

    // Mounts the admin at `path` directly, as when reloading the page, with
    // an item form whose tabs differ from those of the forms of its pages.
    async function mountAdminAt(path) {
      const tabbedPageForm = {
        type: 'form',
        tabs: {
          content: { type: 'tab', fields: { title: { type: 'text' } } },
          text: { type: 'tab', fields: { body: { type: 'textarea' } } }
        }
      }
      const item = { id: 1, title: 'Site', pages: [{ title: 'About' }] }
      const admin = await mountAdmin({
        views: {
          items: {
            type: 'view',
            field: {
              type: 'list',
              resource: { path: 'items' },
              form: {
                type: 'form',
                tabs: {
                  details: {
                    type: 'tab',
                    fields: { title: { type: 'text' } }
                  },
                  planning: {
                    type: 'tab',
                    fields: {
                      pages: {
                        type: 'list',
                        editable: true,
                        path: 'pages',
                        form: tabbedPageForm
                      }
                    }
                  }
                }
              }
            }
          }
        },
        request({ method = 'get', url }) {
          if (method === 'get' && url === '/items') return { data: [item] }
          if (method === 'get' && url === '/items/1') return { data: item }
        }
      })
      await admin.navigate(path)
      const getForms = () => admin.getRouteComponents(isForm)
      await settle(getForms()[0])
      return { admin, getForms }
    }

    it('selects the tab of the source after closing a reloaded form', async () => {
      const { admin, getForms } = await mountAdminAt(
        '/items/1/planning/pages/0/text'
      )
      const [itemForm, pageForm] = getForms()
      const schemaComponent = admin.getSchemaComponent(itemForm)
      expect(admin.getSchemaComponent(pageForm).selectedTab).toBe('text')
      expect(schemaComponent.selectedTab).toBe('planning')
      await pageForm.routeContext.close()
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/planning')
      expect(schemaComponent.selectedTab).toBe('planning')
    })

    it('selects the tab of the route when loaded directly', async () => {
      const { admin, getForms } = await mountAdminAt('/items/1/planning')
      expect(admin.getSchemaComponent(getForms()[0]).selectedTab).toBe(
        'planning'
      )
    })
  })

  it('marks its header and clipboard when they show in the page header', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        clipboard: true,
        fields: {
          details: {
            type: 'section',
            label: 'Details',
            clipboard: true,
            fields: { title: { type: 'text' } }
          }
        }
      },
      data: { title: 'Emma' }
    })
    const pageHeader = wrapper.find('.dito-header .dito-schema-header')
    const sectionHeader = wrapper.find('.dito-section .dito-schema-header')
    expect(pageHeader.classes()).toContain('dito-schema-header--teleported')
    expect(sectionHeader.classes()).not.toContain(
      'dito-schema-header--teleported'
    )
    expect(pageHeader.find('.dito-clipboard').classes()).toContain(
      'dito-clipboard--header'
    )
    expect(sectionHeader.find('.dito-clipboard').classes()).not.toContain(
      'dito-clipboard--header'
    )
  })

  it('makes the page wide while a `wide` view is shown', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          label: 'Books',
          wide: true,
          fields: { title: { type: 'text' } }
        },
        authors: {
          type: 'view',
          label: 'Authors',
          fields: { name: { type: 'text' } }
        }
      }
    })
    const page = () => admin.element.querySelector('main.dito-page')
    await admin.navigate('/books')
    expect(admin.context.pageClass).toBe('dito-page--wide')
    expect(page().classList.contains('dito-page--wide')).toBe(true)
    await admin.navigate('/authors')
    expect(admin.context.pageClass).toBe(null)
    expect(page().classList.contains('dito-page--wide')).toBe(false)
  })

  it.each([
    ['narrow', false, null],
    ['wide', true, 'dito-page--wide']
  ])(
    'makes the page of an item of a `wide` view %s by its form',
    async (_, wide, pageClass) => {
      const item = { id: 1, title: 'Emma' }
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            wide: true,
            field: {
              type: 'list',
              resource: { path: 'books' },
              form: { type: 'form', wide, fields: { title: { type: 'text' } } }
            }
          }
        },
        request({ method = 'get', url }) {
          if (method === 'get' && url === '/books') return { data: [item] }
          if (method === 'get' && url === '/books/1') return { data: item }
        }
      })
      await admin.navigate('/books')
      expect(admin.context.pageClass).toBe('dito-page--wide')
      await admin.navigate('/books/1')
      expect(admin.context.pageClass).toBe(pageClass)
      await admin.navigate('/books')
      expect(admin.context.pageClass).toBe('dito-page--wide')
    }
  )

  describe('revealing components', () => {
    async function mountCollapsedSection() {
      const result = await mountSchema({
        schema: {
          fields: {
            title: { type: 'text' },
            details: {
              type: 'section',
              collapsible: true,
              collapsed: true,
              fields: { notes: { type: 'textarea' } }
            }
          }
        },
        data: { title: 'Emma', notes: 'Classic' }
      })
      const section = result.wrapper
        .findAllComponents(DitoSchema)
        .map(({ vm }) => vm)
        .find(vm => vm.$ !== result.schemaComponent.$)
      const reveal = componentPath =>
        result.admin.context.ui.reveal(
          result.routeComponent.dataContext,
          componentPath,
          { focus: true }
        )
      return { ...result, section, reveal }
    }

    it('opens collapsed schemas to focus their components', async () => {
      const { section, reveal, findField } = await mountCollapsedSection()
      expect(section.opened).toBe(false)
      await reveal('details/notes')
      expect(section.opened).toBe(true)
      expect(document.activeElement).toBe(findField('notes').element)
    })

    it('keeps collapsed schemas closed for other components', async () => {
      const { section, reveal, findField } = await mountCollapsedSection()
      await reveal('title')
      expect(section.opened).toBe(false)
      expect(document.activeElement).toBe(
        findField('title').find('input').element
      )
    })
  })

  describe('validation errors', () => {
    async function mountRequiredTitle() {
      const result = await mountSchema({
        schema: {
          fields: { title: { type: 'text', required: true } }
        },
        data: { title: 'Dune' }
      })
      return { ...result, input: result.findField('title').find('input') }
    }

    // Clears the title like the user does, which validates it on blur:
    async function clearTitle(input) {
      await input.trigger('focus')
      await enterValue(input, '')
      await input.trigger('blur')
    }

    it('links the errors to their input for assistive technology', async () => {
      const { input, findContainer } = await mountRequiredTitle()
      expect(input.attributes('aria-invalid')).toBeUndefined()
      expect(input.attributes('aria-describedby')).toBeUndefined()
      await clearTitle(input)
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

    it('marks the field that shows errors with a modifier', async () => {
      const { input, findField } = await mountRequiredTitle()
      const field = findField('title')
      expect(field.classes()).not.toContain('dito-input--has-errors')
      await clearTitle(input)
      expect(field.classes()).toContain('dito-input--has-errors')
      await input.setValue('Dune')
      expect(field.classes()).not.toContain('dito-input--has-errors')
    })

    it('displays the errors in the document, not in tooltips', async () => {
      const { input, getErrors } = await mountRequiredTitle()
      for (let i = 0; i < 3; i++) {
        await clearTitle(input)
      }
      expect(getErrors('title')).toEqual(['The title field is required.'])
      expect(document.querySelector('[data-tippy-root]')).toBe(null)
    })

    it('keeps the errors when focusing their input', async () => {
      const { input, getErrors } = await mountRequiredTitle()
      await clearTitle(input)
      await input.trigger('focus')
      expect(getErrors('title')).toEqual(['The title field is required.'])
    })

    it('focuses the first invalid field on submit, with errors', async () => {
      const { submit, findField, getErrors } = await mountForm({
        schema: {
          fields: {
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

    it('notifies the errors of fields that are not visible', async () => {
      const { admin, submit } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            updatedAt: { type: 'value', required: true }
          }
        },
        data: { title: 'Dune', updatedAt: null }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      expect(await submit()).toBe(null)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'The field Updated At is required' })
      )
      vi.restoreAllMocks()
    })
  })

  describe('revealing components of the same data', () => {
    const createTitleTabs = summaryTitle => ({
      summary: {
        type: 'tab',
        fields: {
          title: { type: 'text', required: true, ...summaryTitle }
        }
      },
      details: {
        type: 'tab',
        fields: { title: { type: 'text', required: true } }
      }
    })

    it('focuses the first one in schema order', async () => {
      const { routeComponent, schemaComponent, wrapper } = await mountSchema({
        schema: { tabs: createTitleTabs() },
        data: { title: '' }
      })
      schemaComponent.selectTab('details')
      await flushPromises()
      routeComponent.dataContext.validate()
      await flushPromises()
      expect(schemaComponent.selectedTab).toBe('summary')
      const [input] = wrapper.findAll('input[name="title"]')
      expect(document.activeElement).toBe(input.element)
    })

    it('focuses the first one that is rendered', async () => {
      const { routeComponent, schemaComponent, wrapper } = await mountSchema({
        schema: {
          tabs: createTitleTabs({ if: ({ item }) => item.hasSummary })
        },
        data: { title: '', hasSummary: false }
      })
      routeComponent.dataContext.validate()
      await flushPromises()
      expect(schemaComponent.selectedTab).toBe('details')
      const inputs = wrapper.findAll('input[name="title"]')
      expect(inputs).toHaveLength(1)
      expect(document.activeElement).toBe(inputs[0].element)
    })
  })

  describe('validation errors of the server', () => {
    // Returns a request handler that responds to submissions with the
    // validation `errors`, like Dito.js Server does.
    const respondWithErrors =
      errors =>
      ({ method = 'get' }) => {
        if (method !== 'get') {
          throw Object.assign(new Error('Validation failed'), {
            response: { status: 400, data: { type: 'ValidationError', errors } }
          })
        }
        return { data: [] }
      }

    async function mountBookForm(errors, fields = {}) {
      const result = await mountForm({
        schema: {
          label: 'Book',
          fields: { title: { type: 'text' }, ...fields }
        },
        data: { title: 'Emma' },
        request: respondWithErrors(errors)
      })
      const notify = vi.spyOn(result.admin.context, 'notify')
      return { ...result, notify }
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('shows the errors on the fields of their data paths', async () => {
      const { submit, getErrors, notify } = await mountBookForm({
        title: [{ message: 'is already taken' }]
      })
      await submit()
      expect(getErrors('title')).toEqual([
        'The Title field is already taken.'
      ])
      expect(notify).toHaveBeenCalledWith({
        type: 'error',
        title: 'Validation Errors',
        text: 'Please correct the highlighted errors.'
      })
    })

    it('notifies the errors that no field displays', async () => {
      const { submit, notify } = await mountBookForm({
        'isbn': [{ message: 'is invalid' }],
        '': [{ message: 'is incomplete' }]
      })
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: 'The field Isbn is invalid\nThe Book is incomplete'
        })
      )
    })

    it('notifies the errors of fields that are not visible', async () => {
      const { submit, notify } = await mountBookForm(
        { updatedAt: [{ message: 'must be a string' }] },
        { updatedAt: { type: 'value' } }
      )
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'The field Updated At must be a string'
        })
      )
    })

    it('keeps the errors of collapsed sections', async () => {
      const { submit, getErrors, findContainer } = await mountBookForm(
        { subtitle: [{ message: 'is too long' }] },
        {
          details: {
            type: 'section',
            label: 'Details',
            collapsible: true,
            fields: { subtitle: { type: 'text' } }
          }
        }
      )
      await submit()
      expect(getErrors('subtitle')).toEqual(['The Subtitle field is too long.'])
      const toggleDetails = async () => {
        await findContainer('details')
          .find('.dito-schema-header .dito-label')
          .trigger('click')
        await flushPromises()
      }
      await toggleDetails()
      await toggleDetails()
      expect(getErrors('subtitle')).toEqual(['The Subtitle field is too long.'])
    })

    it('keeps the errors of tabs that are not selected', async () => {
      const { submit, getErrors, schemaComponent, dataModel } = await mountForm(
        {
          schema: {
            tabs: {
              main: { type: 'tab', fields: { title: { type: 'text' } } },
              notes: { type: 'tab', fields: { summary: { type: 'text' } } }
            }
          },
          data: { title: 'Emma', summary: 'Short' },
          request: respondWithErrors({
            title: [{ message: 'is taken' }],
            summary: [{ message: 'is too short' }]
          })
        }
      )
      await submit()
      expect(schemaComponent.selectedTab).toBe('main')
      expect(dataModel.getErrors('summary')).toEqual([
        { message: 'is too short' }
      ])
      schemaComponent.selectTab('notes')
      await flushPromises()
      expect(getErrors('summary')).toEqual(['The Summary field is too short.'])
    })

    it('shows the errors of items in their nested forms', async () => {
      const { admin, submit, getErrors } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text' },
                  pages: { type: 'number' }
                }
              }
            }
          }
        },
        data: { title: 'Emma', chapters: [{ title: 'One', pages: 3 }] },
        request: respondWithErrors({
          'chapters/0/title': [{ message: 'is too short' }],
          'chapters/0/pages': [{ message: 'is too few' }],
          'title': [{ message: 'is taken' }]
        })
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await submit()
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      const container = name =>
        admin
          .getComponent(form, `${form.dataPath}/${name}`)
          .$el.closest('.dito-container')
      expect(container('title').textContent).toContain('is too short')
      expect(container('pages').textContent).toContain('is too few')
      // The parent keeps its own errors for when the nested form closes:
      expect(getErrors('title')).toEqual(['The Title field is taken.'])
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Please correct the highlighted errors.'
        })
      )
    })

    it('shows the errors of items in nested forms of lists in tabs', async () => {
      const { admin, submit } = await mountForm({
        schema: {
          tabs: {
            content: {
              type: 'tab',
              fields: {
                chapters: {
                  type: 'list',
                  editable: true,
                  form: {
                    type: 'form',
                    tabs: {
                      text: {
                        type: 'tab',
                        fields: { title: { type: 'text' } }
                      },
                      details: {
                        type: 'tab',
                        fields: { pages: { type: 'number' } }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        data: { chapters: [{ title: 'One', pages: 3 }] },
        request: respondWithErrors({
          'chapters/0/pages': [{ message: 'is too few' }]
        })
      })
      await submit()
      await flushPromises()
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      // The error reveals its tab in the nested form, and focuses its field:
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/content/chapters/0/details'
      )
      const input = form.$el.querySelector(
        'input[id="content/chapters/0/details/pages"]'
      )
      expect(input.closest('.dito-container').textContent).toContain(
        'is too few'
      )
      expect(document.activeElement).toBe(input)
    })

    it('notifies the errors that the nested forms do not show', async () => {
      const { admin, submit } = await mountForm({
        schema: {
          fields: {
            chapters: {
              type: 'list',
              editable: true,
              form: { type: 'form', fields: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }, { title: 'Two' }] },
        request: respondWithErrors({
          'chapters/0/title': [{ message: 'is too short' }],
          'chapters/1/title': [{ message: 'is taken' }]
        })
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await submit()
      await flushPromises()
      // Only the form of the first item is opened:
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'The field Title is taken' })
      )
    })
  })

  describe('filters', () => {
    it('clears the filters with their clear button', async () => {
      const { admin, settle } = await mountSchema({
        schema: {
          fields: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              filters: { title: { filter: 'text' } },
              columns: { title: {} }
            }
          }
        },
        request: () => ({ data: [] })
      })
      const panel = admin.wrapper.find('.dito-panel[aria-label="Filters"]')
      const input = panel.find('input[name$="text"]')
      await enterValue(input, 'Emma')
      await settle()
      expect(admin.router.currentRoute.value.query.filter).toEqual([
        'title:"Emma"'
      ])
      await panel.find('button[aria-label="Clear"]').trigger('click')
      await settle()
      expect(input.element.value).toBe('')
      expect(admin.router.currentRoute.value.query.filter).toEqual([])
    })

    it(`doesn't apply filters with fields that hold no value`, async () => {
      const { admin, settle } = await mountSchema({
        schema: {
          fields: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              filters: {
                isRead: { fields: { isRead: { type: 'checkbox' } } }
              },
              columns: { title: {} }
            }
          }
        },
        request: () => ({ data: [] })
      })
      const panel = admin.wrapper.find('.dito-panel[aria-label="Filters"]')
      const checkbox = panel.find('input[type="checkbox"]')
      await checkbox.setValue(true)
      await settle()
      expect(admin.router.currentRoute.value.query.filter).toEqual([
        'isRead:true'
      ])
      await panel.find('button[aria-label="Clear"]').trigger('click')
      await settle()
      expect(checkbox.element.checked).toBe(false)
      expect(admin.router.currentRoute.value.query.filter).toEqual([])
    })
  })

  describe('validation errors of filters', () => {
    it('shows them in the filters panel', async () => {
      const { admin, settle } = await mountSchema({
        schema: {
          fields: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              filters: { title: { filter: 'text' } },
              columns: { title: {} }
            }
          }
        },
        request: ({ query }) => {
          if (query?.filter?.length) {
            throw Object.assign(new Error('Invalid filter'), {
              response: {
                status: 400,
                data: {
                  type: 'FilterValidation',
                  errors: { 'title/text': [{ message: 'is too short' }] }
                }
              }
            })
          }
          return { data: [] }
        }
      })
      const panel = admin.wrapper.find('.dito-panel[aria-label="Filters"]')
      await enterValue(panel.find('input[name$="text"]'), 'E')
      await settle()
      expect(panel.find('.dito-errors').text()).toContain('is too short')
    })
  })

  describe('revealing components of inlined schemas', () => {
    async function mountCollapsedAuthor() {
      return mountSchema({
        schema: {
          fields: {
            author: {
              type: 'object',
              inlined: true,
              collapsible: true,
              collapsed: true,
              form: {
                type: 'form',
                fields: { name: { type: 'text', required: true } }
              }
            }
          }
        },
        data: { author: { name: '' } }
      })
    }

    it('opens collapsed inlined schemas to focus their errors', async () => {
      const { routeComponent, findField } = await mountCollapsedAuthor()
      expect(findField('author/name').exists()).toBe(false)
      routeComponent.dataContext.validate()
      // The field is focused once the opening transition has measured it:
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          findField('author/name').find('input').element
        )
      )
    })
  })

  describe('tabs selected by the route', () => {
    it('falls back to the default tab for tabs that are hidden', async () => {
      const { admin, schemaComponent } = await mountSchema({
        schema: {
          tabs: {
            details: { type: 'tab', fields: { title: { type: 'text' } } },
            drafts: {
              type: 'tab',
              if: false,
              fields: { notes: { type: 'text' } }
            }
          }
        },
        data: { title: 'Emma' }
      })
      await admin.navigate('/test/drafts')
      expect(admin.router.currentRoute.value.path).toBe('/test/details')
      expect(schemaComponent.selectedTab).toBe('details')
    })

    it('leaves the tab out of the path without rendered tabs', async () => {
      const { admin, schemaComponent } = await mountSchema({
        schema: {
          tabs: {
            drafts: {
              type: 'tab',
              if: false,
              fields: { notes: { type: 'text' } }
            }
          }
        },
        data: { notes: '' }
      })
      expect(schemaComponent.selectedTab).toBe(null)
      await admin.navigate('/test/drafts')
      expect(admin.router.currentRoute.value.path).toBe('/test')
    })
  })

  it('sets up forms that depend on the loaded item once loaded', async () => {
    const initialize = vi.fn()
    let loadItem
    const admin = await mountAdmin({
      views: {
        blocks: {
          type: 'view',
          field: {
            type: 'list',
            resource: { path: 'blocks' },
            forms: {
              heading: {
                type: 'form',
                onInitialize: initialize,
                fields: { text: { type: 'text' } }
              },
              image: {
                type: 'form',
                fields: { url: { type: 'url' } }
              }
            }
          }
        }
      },
      request: ({ url }) =>
        url === '/blocks/1'
          ? new Promise(resolve => {
              loadItem = () =>
                resolve({ data: { id: 1, type: 'heading', text: 'Intro' } })
            })
          : { data: [] }
    })
    await admin.navigate('/blocks/1')
    const form = admin.getRouteComponent(isForm)
    expect(initialize).not.toHaveBeenCalled()
    loadItem()
    await settle(form)
    expect(initialize).toHaveBeenCalledOnce()
  })
})
