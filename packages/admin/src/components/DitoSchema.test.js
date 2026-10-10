import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import DitoContext from '../DitoContext.js'
import appState from '../appState.js'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  enterValue
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

      it('validates nothing before the item is loaded', async () => {
        const { schemaComponent, loadItem } =
          await mountLoadingForm(
            '/items/1'
          )
        expect(schemaComponent.hasData).toBe(false)
        expect(schemaComponent.verifyAll()).toBe(true)
        await loadItem()
        expect(schemaComponent.hasData).toBe(true)
      })

      it('keeps the tab selected by the route', async () => {
        const { schemaComponent, loadItem } =
          await mountLoadingForm('/items/1#details')
        await loadItem()
        expect(schemaComponent.selectedTab).toBe('details')
      })
    })
  })

  // ditojs/dito#192: The forms of the items of trees and lists in tabs are
  // nested routes, whose path doesn't carry the hash of the parent's tab.
  describe('tabs with forms of nested routes', () => {
    const pageForm = { type: 'form', components: { title: { type: 'text' } } }

    it.each([
      ['tree-list', { type: 'tree-list', editable: true }],
      ['list', { type: 'list', editable: true }]
    ])('keeps the tab of a %s after closing its form', async (_, source) => {
      const { admin, schemaComponent, wrapper } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', components: { title: { type: 'text' } } },
            planning: {
              type: 'tab',
              components: {
                pages: { ...source, path: 'pages', form: pageForm }
              }
            }
          }
        },
        data: { title: 'Site', pages: [{ title: 'About' }] }
      })
      await admin.navigate('/items/1#planning')
      await wrapper.find('.dito-button--edit').trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/pages/0')
      expect(schemaComponent.selectedTab).toBe('planning')
      const pageFormComponent = admin.getRouteComponent(
        component => component.isForm
      )
      await pageFormComponent.close()
      await flushPromises()
      // The route is kept without hash, as before, but the tab stays selected:
      expect(admin.router.currentRoute.value.fullPath).toBe('/items/1')
      expect(schemaComponent.selectedTab).toBe('planning')
    })

    // Mounts the admin at `path` directly, as when reloading the page, with
    // an item form whose tabs differ from those of the forms of its pages.
    async function mountAdminAt(path) {
      const tabbedPageForm = {
        type: 'form',
        tabs: {
          content: { type: 'tab', components: { title: { type: 'text' } } },
          text: { type: 'tab', components: { body: { type: 'textarea' } } }
        }
      }
      const item = { id: 1, title: 'Site', pages: [{ title: 'About' }] }
      const admin = await mountAdmin({
        views: {
          items: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'items' },
              form: {
                type: 'form',
                tabs: {
                  details: {
                    type: 'tab',
                    components: { title: { type: 'text' } }
                  },
                  planning: {
                    type: 'tab',
                    components: {
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
      const getForms = () =>
        appState.routeComponents.filter(component => component.isForm)
      await settle(getForms()[0])
      return { admin, getForms }
    }

    it('selects the default tab after closing a reloaded form', async () => {
      const { admin, getForms } = await mountAdminAt('/items/1/pages/0#text')
      const [itemForm, pageForm] = getForms()
      const schemaComponent = itemForm.mainSchemaComponent
      expect(pageForm.mainSchemaComponent.selectedTab).toBe('text')
      await pageForm.close()
      await flushPromises()
      expect(admin.router.currentRoute.value.fullPath).toBe('/items/1')
      // The tab of the page form isn't one of the item form's tabs:
      expect(schemaComponent.selectedTab).toBe('details')
    })

    it('selects the tab of the route when loaded directly', async () => {
      const { getForms } = await mountAdminAt('/items/1#planning')
      expect(getForms()[0].mainSchemaComponent.selectedTab).toBe('planning')
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

  describe('component lookup', () => {
    async function mountBookSchema() {
      const result = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            author: {
              type: 'object',
              inlined: true,
              form: { type: 'form', components: { name: { type: 'text' } } }
            }
          },
          panels: {
            summary: {
              type: 'panel',
              label: 'Summary',
              components: { notes: { type: 'textarea' } }
            }
          }
        },
        data: { title: 'Emma', author: { name: 'Jane' }, notes: 'Classic' }
      })
      const author = result.wrapper
        .findAllComponents({ name: 'DitoSchema' })
        .map(({ vm }) => vm)
        .find(vm => vm.dataPath === 'author')
      return { ...result, author }
    }

    it('finds components by name or by data path', async () => {
      const { schemaComponent, author } = await mountBookSchema()
      const title = schemaComponent.getComponent('title')
      expect(title.name).toBe('title')
      expect(schemaComponent.getComponentByName('title')).toBe(title)
      expect(schemaComponent.getComponentByName('isbn')).toBe(null)
      expect(schemaComponent.getComponent('isbn')).toBe(null)
      // Nested schemas find their components by their own name, and by the
      // full data path:
      const name = author.getComponent('name')
      expect(name.dataPath).toBe('author/name')
      expect(author.getComponent('author/name')).toBe(name)
      expect(schemaComponent.getComponent('author/name')).toBe(name)
    })

    it('finds panels by name or by data path', async () => {
      const { schemaComponent } = await mountBookSchema()
      const [panel] = schemaComponent.panels
      expect(panel.schema.label).toBe('Summary')
      // Panels are addressed by their name, as if they were nested:
      expect(panel.dataPath).toBe('summary')
      expect(schemaComponent.getPanel('summary') === panel).toBe(true)
      expect(schemaComponent.getPanelByDataPath('summary') === panel).toBe(
        true
      )
      expect(schemaComponent.getPanelByDataPath('notes')).toBe(null)
      expect(schemaComponent.getPanel('notes')).toBe(null)
    })

    it('lists its panes by data path', async () => {
      const { schemaComponent, author } = await mountBookSchema()
      expect(schemaComponent.panes).toHaveLength(1)
      expect(Object.keys(schemaComponent.panesByDataPath)).toEqual([''])
      expect(Object.keys(author.panesByDataPath)).toEqual(['author'])
    })

    it('sorts components of the same data in document order', async () => {
      const { schemaComponent, wrapper } = await mountSchema({
        schema: {
          tabs: {
            summary: {
              type: 'tab',
              components: { title: { type: 'text', label: 'Short Title' } }
            },
            details: {
              type: 'tab',
              components: { title: { type: 'text', label: 'Full Title' } }
            },
            print: {
              type: 'tab',
              components: { title: { type: 'text', label: 'Print Title' } }
            }
          }
        },
        data: { title: 'Emma' }
      })
      const components = schemaComponent.getComponents('title')
      expect(components.map(component => component.label)).toEqual([
        'Short Title',
        'Full Title',
        'Print Title'
      ])
      const inputs = wrapper.findAll('input[name="title"]')
      expect(
        components.map(component => component.$el.contains(inputs[0].element))
      ).toEqual([true, false, false])
    })

    it('sorts components rendered later in document order', async () => {
      const { schemaComponent, data, settle } = await mountSchema({
        schema: {
          tabs: {
            summary: {
              type: 'tab',
              components: {
                title: {
                  type: 'text',
                  label: 'Short Title',
                  if: ({ item }) => item.hasSummary
                }
              }
            },
            details: {
              type: 'tab',
              components: { title: { type: 'text', label: 'Full Title' } }
            }
          }
        },
        data: { title: 'Emma', hasSummary: false }
      })
      const getLabels = () =>
        schemaComponent.getComponents('title').map(({ label }) => label)
      expect(getLabels()).toEqual(['Full Title'])
      data.hasSummary = true
      await settle()
      expect(getLabels()).toEqual(['Short Title', 'Full Title'])
    })
  })

  describe('setData()', () => {
    it('merges the known values and marks their components dirty', async () => {
      const { schemaComponent, data, getComponent } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            year: { type: 'number' }
          }
        },
        data: { title: 'Emma', year: 1815 }
      })
      expect(
        schemaComponent.setData({ title: 'Persuasion', year: 1815, isbn: 1 })
      ).toBe(data)
      expect(data).toEqual({ title: 'Persuasion', year: 1815 })
      expect(getComponent('title').isDirty).toBe(true)
      // Unchanged values don't make their components dirty:
      expect(getComponent('year').isDirty).toBe(false)
      expect(schemaComponent.isDirty).toBe(true)
    })
  })

  describe('hasErrors', () => {
    it('tells whether any of its components shows errors', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text', required: true } } },
        data: { title: '' }
      })
      expect(schemaComponent.hasErrors).toBe(false)
      expect(schemaComponent.validateAll()).toBe(false)
      await flushPromises()
      expect(schemaComponent.hasErrors).toBe(true)
      schemaComponent.clearErrors()
      expect(schemaComponent.hasErrors).toBe(false)
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

    async function mountBookForm(errors, components = {}) {
      const result = await mountForm({
        schema: {
          label: 'Book',
          components: { title: { type: 'text' }, ...components }
        },
        data: { title: 'Emma' },
        request: respondWithErrors(errors)
      })
      const notify = vi.spyOn(result.admin.root, 'notify')
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

    it('shows the errors of items in their nested forms', async () => {
      const { admin, submit, getErrors } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                type: 'form',
                components: {
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
      await submit()
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      const container = name =>
        form.mainSchemaComponent
          .getComponent(name)
          .$el.closest('.dito-container')
      expect(container('title').textContent).toContain('is too short')
      expect(container('pages').textContent).toContain('is too few')
      expect(getErrors('title')).toEqual([])
    })
  })

  describe('filterData()', () => {
    it('keeps the data of lists with resources when saving', async () => {
      const { submit, data, settle } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            tags: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                components: { name: { type: 'text' } }
              }
            },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              columns: { text: {} }
            }
          }
        },
        data: {
          title: 'Emma',
          tags: [{ name: 'Classic' }],
          reviews: [{ id: 1, text: 'Witty' }]
        },
        // The saved item doesn't contain the reviews, which have their own
        // resource:
        request: ({ method = 'get', url, data }) =>
          method === 'get'
            ? {
                data: url.endsWith('/reviews') ? [{ id: 1, text: 'Witty' }] : []
              }
            : { data: { id: 1, title: data.title, tags: data.tags } }
      })
      await submit()
      await settle()
      expect(data.reviews).toEqual([{ id: 1, text: 'Witty' }])
      expect(data.tags).toEqual([{ name: 'Classic' }])
    })
  })

  describe('resetData()', () => {
    it('clears the filters with their clear button', async () => {
      const { admin, settle } = await mountSchema({
        schema: {
          components: {
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
  })

  describe('validation errors of filters', () => {
    it('shows them in the filters panel', async () => {
      const { admin, settle } = await mountSchema({
        schema: {
          components: {
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

  describe('showValidationErrors()', () => {
    it(`doesn't notify the errors unless it's the first schema`, async () => {
      const { schemaComponent, admin, getErrors } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      const notify = vi.spyOn(admin.root, 'notify')
      const errors = { title: [{ message: 'is taken' }] }
      expect(
        await schemaComponent.showValidationErrors(errors, false, false)
      ).toBe(true)
      expect(getErrors('title')).toEqual(['The title field is taken.'])
      expect(notify).not.toHaveBeenCalled()
      expect(await schemaComponent.showValidationErrors(errors, false)).toBe(
        true
      )
      expect(notify).toHaveBeenCalledOnce()
    })
  })

  describe('navigateToComponent() with `onComplete()`', () => {
    async function mountCollapsedAuthor() {
      return mountSchema({
        schema: {
          components: {
            author: {
              type: 'object',
              inlined: true,
              collapsible: true,
              collapsed: true,
              form: { type: 'form', components: { name: { type: 'text' } } }
            }
          }
        },
        data: { author: { name: 'Jane' } }
      })
    }

    it('reveals the components of collapsed inlined schemas', async () => {
      const { schemaComponent } = await mountCollapsedAuthor()
      expect(schemaComponent.getComponent('author/name')).toBe(null)
      expect(await schemaComponent.navigateToComponent('author/name')).toBe(
        true
      )
      expect(schemaComponent.getComponent('author/name')).not.toBe(null)
    })

    it('reveals inlined ones with `shouldRevealInlinedOnly`', async () => {
      const { schemaComponent } = await mountCollapsedAuthor()
      const onComplete = vi.fn(() => true)
      expect(
        await schemaComponent.navigateToComponent('author/name', onComplete, {
          shouldRevealInlinedOnly: true
        })
      ).toBe(true)
      expect(onComplete).toHaveBeenCalledWith([
        expect.objectContaining({ dataPath: 'author/name' })
      ])
    })

    it('fails when `onComplete()` rejects the components', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      const onComplete = vi.fn(() => false)
      expect(
        await schemaComponent.navigateToComponent('title', onComplete)
      ).toBe(false)
      expect(onComplete).toHaveBeenCalledOnce()
    })
  })

  describe('tabs selected by the route', () => {
    it('falls back to the default tab for tabs that are hidden', async () => {
      const { admin, schemaComponent } = await mountSchema({
        schema: {
          tabs: {
            details: { type: 'tab', components: { title: { type: 'text' } } },
            drafts: {
              type: 'tab',
              if: false,
              components: { notes: { type: 'text' } }
            }
          }
        },
        data: { title: 'Emma' }
      })
      await admin.navigate('/test#drafts')
      expect(admin.router.currentRoute.value.hash).toBe('#details')
      expect(schemaComponent.selectedTab).toBe('details')
    })

    it('removes the hash without any rendered tabs', async () => {
      const { admin, schemaComponent } = await mountSchema({
        schema: {
          tabs: {
            drafts: {
              type: 'tab',
              if: false,
              components: { notes: { type: 'text' } }
            }
          }
        },
        data: { notes: '' }
      })
      expect(schemaComponent.selectedTab).toBe(null)
      await admin.navigate('/test#drafts')
      expect(admin.router.currentRoute.value.hash).toBe('')
    })
  })

  it('sets up forms that depend on the loaded item once loaded', async () => {
    const initialize = vi.fn()
    let loadItem
    const admin = await mountAdmin({
      views: {
        blocks: {
          type: 'view',
          component: {
            type: 'list',
            resource: { path: 'blocks' },
            forms: {
              heading: {
                type: 'form',
                events: { initialize },
                components: { text: { type: 'text' } }
              },
              image: {
                type: 'form',
                components: { url: { type: 'url' } }
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
    const form = admin.getRouteComponent(component => component.isForm)
    expect(initialize).not.toHaveBeenCalled()
    loadItem()
    await settle(form)
    expect(initialize).toHaveBeenCalledOnce()
  })
})
