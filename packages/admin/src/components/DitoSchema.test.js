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

describe('DitoSchema', () => {
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
        const { routeComponent, schemaComponent, loadItem } =
          await mountLoadingForm('/items/1')
        expect(schemaComponent.hasData).toBe(false)
        expect(routeComponent.dataContext.verify()).toBe(true)
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
      const { submit, getErrors, schemaComponent } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', components: { title: { type: 'text' } } },
            reviews: {
              type: 'tab',
              components: { rating: { type: 'number', required: true } }
            }
          }
        },
        data: { title: 'Emma', rating: null }
      })
      expect(schemaComponent.selectedTab).toBe('details')
      expect(await submit()).toBe(null)
      expect(schemaComponent.selectedTab).toBe('reviews')
      expect(getErrors('rating')).toEqual(['The Rating field is required.'])
      expect(document.activeElement.name).toBe('rating')
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
      const pageFormComponent =
        admin.getRouteComponent(
          isForm
        )
      await pageFormComponent.routeContext.close()
      await flushPromises()
      // The route is kept without hash, as before, but the tab stays selected:
      expect(admin.router.currentRoute.value.fullPath).toBe('/items/1')
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
          { type: 'tab', components: { [name]: { type: 'text' } } }
        ])
      )
      const { admin, schemaComponent, wrapper } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', components: { title: { type: 'text' } } },
            planning: {
              type: 'tab',
              components: {
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
      await admin.navigate('/items/1#planning')
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
      expect(admin.router.currentRoute.value.fullPath).toBe(
        '/items/1/pages/0#content'
      )
      expect(schemaComponent.selectedTab).toBe('planning')
      expect(pageSchemaComponent.selectedTab).toBe('content')
      await admin.navigate('/items/1/pages/0#text')
      expect(pageSchemaComponent.selectedTab).toBe('text')
      expect(schemaComponent.selectedTab).toBe('planning')
    })

    it('keeps the tab of a form whose tab names its items use', async () => {
      const { admin, schemaComponent, pageSchemaComponent, getReplaceCount } =
        await openTabbedPageForm(['content', 'details'])
      expect(getReplaceCount()).toBeLessThanOrEqual(1)
      expect(schemaComponent.selectedTab).toBe('planning')
      expect(pageSchemaComponent.selectedTab).toBe('content')
      await admin.navigate('/items/1/pages/0#details')
      expect(pageSchemaComponent.selectedTab).toBe('details')
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
      const getForms = () => admin.getRouteComponents(isForm)
      await settle(getForms()[0])
      return { admin, getForms }
    }

    it('selects the default tab after closing a reloaded form', async () => {
      const { admin, getForms } = await mountAdminAt('/items/1/pages/0#text')
      const [itemForm, pageForm] = getForms()
      const schemaComponent = admin.getSchemaComponent(itemForm)
      expect(admin.getSchemaComponent(pageForm).selectedTab).toBe('text')
      await pageForm.routeContext.close()
      await flushPromises()
      expect(admin.router.currentRoute.value.fullPath).toBe('/items/1')
      // The tab of the page form isn't one of the item form's tabs:
      expect(schemaComponent.selectedTab).toBe('details')
    })

    it('selects the tab of the route when loaded directly', async () => {
      const { admin, getForms } = await mountAdminAt('/items/1#planning')
      expect(admin.getSchemaComponent(getForms()[0]).selectedTab).toBe(
        'planning'
      )
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
    expect(admin.context.pageClass).toBe('dito-page--wide')
    expect(page().classList.contains('dito-page--wide')).toBe(true)
    await admin.navigate('/authors')
    expect(admin.context.pageClass).toBe(null)
    expect(page().classList.contains('dito-page--wide')).toBe(false)
  })

  describe('revealing components', () => {
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

  describe('revealing components of the same data', () => {
    const createTitleTabs = summaryTitle => ({
      summary: {
        type: 'tab',
        components: {
          title: { type: 'text', required: true, ...summaryTitle }
        }
      },
      details: {
        type: 'tab',
        components: { title: { type: 'text', required: true } }
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

    async function mountBookForm(errors, components = {}) {
      const result = await mountForm({
        schema: {
          label: 'Book',
          components: { title: { type: 'text' }, ...components }
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

    it('keeps the errors of collapsed sections', async () => {
      const { submit, getErrors, findContainer } = await mountBookForm(
        { subtitle: [{ message: 'is too long' }] },
        {
          details: {
            type: 'section',
            label: 'Details',
            collapsible: true,
            components: { subtitle: { type: 'text' } }
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
              main: { type: 'tab', components: { title: { type: 'text' } } },
              notes: { type: 'tab', components: { summary: { type: 'text' } } }
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
    })
  })

  describe('filters', () => {
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

  describe('revealing components of inlined schemas', () => {
    async function mountCollapsedAuthor() {
      return mountSchema({
        schema: {
          components: {
            author: {
              type: 'object',
              inlined: true,
              collapsible: true,
              collapsed: true,
              form: {
                type: 'form',
                components: { name: { type: 'text', required: true } }
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
      await flushPromises()
      const input = findField('author/name').find('input')
      expect(document.activeElement).toBe(input.element)
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
                onInitialize: initialize,
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
    const form = admin.getRouteComponent(isForm)
    expect(initialize).not.toHaveBeenCalled()
    loadItem()
    await settle(form)
    expect(initialize).toHaveBeenCalledOnce()
  })
})
