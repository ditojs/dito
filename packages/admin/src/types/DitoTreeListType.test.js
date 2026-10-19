import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { getValueAtDataPath, hyphenate } from '@ditojs/utils'
import { setupView } from '../utils/schema/setup.js'
import {
  mountForm,
  mountSchema,
  stubConfirm,
  enterValue,
  isForm
} from '../test/mount.js'
import DitoDraggable from '../components/DitoDraggable.vue'

const pageForm = {
  type: 'form',
  label: 'Page',
  components: { title: { type: 'text' } }
}

function createSiteSchema(pages = {}) {
  return {
    components: {
      pages: {
        type: 'tree-list',
        label: 'Pages',
        path: 'pages',
        itemLabel: 'title',
        form: pageForm,
        children: {
          name: 'subpages',
          path: 'subpages',
          itemLabel: 'title',
          form: pageForm
        },
        ...pages
      }
    }
  }
}

const site = {
  pages: [
    {
      title: 'About',
      subpages: [{ title: 'Team' }, { title: 'History' }]
    },
    { title: 'Contact', subpages: [] }
  ]
}

function getLabels(field) {
  return field
    .findAll('.dito-tree-header')
    .filter(header => header.isVisible())
    .map(header => header.find('.dito-tree-label').text())
}

function findButton(field, label, selector) {
  return field
    .findAll('.dito-tree-header')
    .find(header => header.find('.dito-tree-label').text() === label)
    .find(selector)
}

describe('DitoTreeListType', () => {
  it('renders the items and opens their children on click', async () => {
    const { findField } = await mountForm({
      schema: createSiteSchema(),
      data: site
    })
    const field = findField('pages')
    expect(getLabels(field)).toEqual(['About', 'Contact'])
    const about = field.findAll('.dito-tree-branch')[0]
    expect(about.find('.dito-tree-info').text()).toBe('2 items')
    await about.trigger('click')
    await flushPromises()
    expect(about.attributes('aria-expanded')).toBe('true')
    expect(getLabels(findField('pages'))).toEqual([
      'About',
      'Team',
      'History',
      'Contact'
    ])
  })

  it('marks the tree and its items with their roles', async () => {
    const schema = createSiteSchema()
    schema.components.pages.collapsed = false
    const { findField } = await mountForm({ schema, data: site })
    const tree = findField('pages').find('[role="tree"]')
    expect(tree.attributes('aria-label')).toBe('Pages')
    const getIds = selector =>
      tree.findAll(selector).map(item => item.attributes('id'))
    expect(getIds('[role="treeitem"]')).toEqual([
      'pages/0',
      'pages/0/subpages/0',
      'pages/0/subpages/1',
      'pages/1'
    ])
    // Only the children of items are grouped, not the items of the tree:
    expect(getIds('[role="group"] > [role="treeitem"]')).toEqual([
      'pages/0/subpages/0',
      'pages/0/subpages/1'
    ])
  })

  it('expands all items with `collapsed: false`', async () => {
    const schema = createSiteSchema()
    schema.components.pages.collapsed = false
    schema.components.pages.children.collapsed = false
    const { findField } = await mountForm({ schema, data: site })
    expect(getLabels(findField('pages'))).toEqual([
      'About',
      'Team',
      'History',
      'Contact'
    ])
  })

  it('resolves `collapsed` callbacks per item', async () => {
    const schema = createSiteSchema({
      collapsed: ({ item }) => item.title !== 'About'
    })
    const { findField } = await mountForm({ schema, data: site })
    expect(getLabels(findField('pages'))).toEqual([
      'About',
      'Team',
      'History',
      'Contact'
    ])
  })

  it('fires `toggle` with the item when items expand and collapse', async () => {
    const onToggle = vi.fn()
    const { findField } = await mountForm({
      schema: createSiteSchema({ onToggle }),
      data: site
    })
    const about = findField('pages').findAll('.dito-tree-branch')[0]
    await about.trigger('click')
    await about.trigger('click')
    expect(
      onToggle.mock.calls.map(([{ item, collapsed }]) => [
        item.title,
        collapsed
      ])
    ).toEqual([
      ['About', false],
      ['About', true]
    ])
  })

  it.each([
    ['open', 'trees', 'pages', 'collapsed', schema => schema.components.pages],
    [
      'expanded',
      'their children',
      'subpages',
      'collapsed: false',
      schema => schema.components.pages.children
    ]
  ])('rejects `%s` in %s', async (key, _, name, replacement, getTree) => {
    const schema = { type: 'view', ...createSiteSchema() }
    getTree(schema)[key] = true
    await expect(
      setupView({ defaults: {}, normalizePath: hyphenate }, schema, 'site')
    ).rejects.toThrow(
      `Unsupported schema key '${key}' in '${name}': Use '${
        replacement
      }' instead.`
    )
  })

  it('sets up the buttons of their children', async () => {
    const schema = { type: 'view', ...createSiteSchema() }
    schema.components.pages.children.buttons = {
      order: { type: 'button', data: {} }
    }
    await expect(
      setupView({ defaults: {}, normalizePath: hyphenate }, schema, 'site')
    ).rejects.toThrow(`Unsupported schema key 'data' in 'order'`)
  })

  it('renders the `properties` of the items', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.properties = {
      slug: {
        label: 'Slug',
        render: ({ item }) => item.title.toLowerCase()
      }
    }
    schema.components.pages.children.collapsed = false
    const { findField } = await mountForm({ schema, data: site })
    const properties = findField('pages')
      .findAll('.dito-properties')
      .map(table => table.text())
    expect(properties).toEqual([
      expect.stringContaining('team'),
      expect.stringContaining('history')
    ])
  })

  it('renders the prefix and suffix of item labels', async () => {
    const { findField } = await mountForm({
      schema: createSiteSchema({
        itemLabel: ({ item }) => ({
          text: item.title,
          prefix: 'Page',
          suffix: `${item.subpages.length} subpages`
        })
      }),
      data: site
    })
    const label = findField('pages').find('.dito-tree-label').text()
    expect(label).toContain('Page')
    expect(label).toContain('About')
    expect(label).toContain('2 subpages')
  })

  it('navigates to the form of the item with the edit button', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.editable = true
    const { admin, findField } = await mountForm({ schema, data: site })
    // Edit the second subpage of the first page:
    await findField('pages').findAll('.dito-button--edit')[1].trigger('click')
    await flushPromises()
    expect(admin.router.currentRoute.value.path).toBe(
      '/items/1/pages/0/subpages/1'
    )
  })

  it('shows the server errors of items in their forms', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.editable = true
    const { admin, submit } = await mountForm({
      schema,
      data: site,
      request: () => {
        throw Object.assign(new Error('Validation failed'), {
          response: {
            status: 400,
            data: {
              type: 'ValidationError',
              errors: { 'pages/0/subpages/1/title': [{ message: 'is taken' }] }
            }
          }
        })
      }
    })
    await submit()
    await flushPromises()
    expect(admin.router.currentRoute.value.path).toBe(
      '/items/1/pages/0/subpages/1'
    )
    const form = admin.getRouteComponent(isForm)
    expect(form.data.title).toBe('History')
    expect(form.$el.querySelector('.dito-errors').textContent).toBe(
      'The Title field is taken.'
    )
  })

  it('shows the server errors of items in their open forms', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.editable = true
    const { admin, wrapper, routeComponent } = await mountForm({
      schema,
      data: site,
      request: ({ method = 'get' }) => {
        if (method !== 'get') {
          throw Object.assign(new Error('Validation failed'), {
            response: {
              status: 400,
              data: {
                type: 'ValidationError',
                errors: {
                  'pages/0/subpages/1/title': [{ message: 'is taken' }]
                }
              }
            }
          })
        }
        return { data: site }
      }
    })
    await admin.navigate('/items/1/pages/0/subpages/1')
    const form = admin.getRouteComponent(isForm)
    expect(form.isEmbeddedRoute).toBe(true)
    // The form of the tree item displays inside its parent, which saves:
    await wrapper
      .findAll('.dito-buttons--main button[type="submit"]')
      .find(
        button => button.element.closest('.dito-form') === routeComponent.$el
      )
      .trigger('click')
    await flushPromises()
    expect(admin.router.currentRoute.value.path).toBe(
      '/items/1/pages/0/subpages/1'
    )
    expect(form.$el.querySelector('.dito-errors')?.textContent).toBe(
      'The Title field is taken.'
    )
  })

  it('marks the items with errors within them', async () => {
    const schema = createSiteSchema()
    schema.components.pages.collapsed = false
    const { findField, dataModel, data } = await mountForm({
      schema,
      data: site
    })
    dataModel.replaceErrors(
      { 'pages/0/subpages/1/title': [{ message: 'is taken' }] },
      { server: true }
    )
    await flushPromises()
    const getMarkedLabels = () =>
      findField('pages')
        .findAll('.dito-tree-item--error > .dito-tree-header')
        .map(header => header.find('.dito-tree-label').text())
    expect(getMarkedLabels()).toEqual(['About', 'History'])
    data.pages[0].subpages[1].title = 'Heritage'
    await flushPromises()
    expect(getMarkedLabels()).toEqual([])
    dataModel.setErrors('pages/0/title', [{ message: 'is taken' }])
    await flushPromises()
    expect(getMarkedLabels()).toEqual(['About'])
  })

  it('opens the items that come into the edit path', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.editable = true
    const { admin, findField } = await mountForm({ schema, data: site })
    expect(getLabels(findField('pages'))).toEqual(['About', 'Contact'])
    await admin.navigate('/items/1/pages/0/subpages/1')
    expect(getLabels(findField('pages'))).toEqual([
      'About',
      'Team',
      'History',
      'Contact'
    ])
  })

  it('provides the serialized draft and root item to the forms of its items', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.editable = true
    const { admin } = await mountForm({ schema, data: site })
    await admin.navigate('/items/1/pages/0/subpages/1')
    const form = admin.getRouteComponent(isForm)
    form.data.title = 'Story'
    const { context } = admin.getSchemaComponent(form)
    expect(context.serializedItem).toEqual({ title: 'Story' })
    // The root item is the one of the site form, with the draft in place of
    // the item, like `rootItem`:
    expect(context.serializedRootItem).toMatchObject({
      pages: [
        { title: 'About', subpages: [{ title: 'Team' }, { title: 'Story' }] },
        { title: 'Contact', subpages: [] }
      ]
    })
  })

  it('reopens closed items of expanded trees that come into the edit path', async () => {
    const schema = createSiteSchema({ collapsed: false })
    schema.components.pages.children.editable = true
    const { admin, findField } = await mountForm({ schema, data: site })
    const about = findField('pages').findAll('.dito-tree-branch')[0]
    expect(about.attributes('aria-expanded')).toBe('true')
    await about.trigger('click')
    await flushPromises()
    expect(about.attributes('aria-expanded')).toBe('false')
    await admin.navigate('/items/1/pages/0/subpages/1')
    expect(about.attributes('aria-expanded')).toBe('true')
  })

  it('opens the items of expanded trees without edit routes', async () => {
    const { findField } = await mountForm({
      schema: {
        components: {
          pages: {
            type: 'tree-list',
            itemLabel: 'title',
            collapsed: false,
            children: { name: 'subpages', itemLabel: 'title', collapsed: false }
          }
        }
      },
      data: site
    })
    expect(getLabels(findField('pages'))).toEqual([
      'About',
      'Team',
      'History',
      'Contact'
    ])
  })

  it('opens only the items whose path contains the edit path', async () => {
    const schema = createSiteSchema({ editable: true })
    const pages = Array.from({ length: 11 }, (_, index) => ({
      title: `Page ${index}`,
      subpages: [{ title: `Subpage ${index}` }]
    }))
    const { admin, findField } = await mountForm({
      schema,
      data: { pages }
    })
    await admin.navigate('/items/1/pages/10/subpages/0')
    const branches = findField('pages').findAll('.dito-tree-branch')
    const isExpanded = index => (
      branches[index].attributes('aria-expanded') === 'true'
    )
    // `/pages/10` starts with `/pages/1`, but isn't within it:
    expect(isExpanded(1)).toBe(false)
    expect(isExpanded(10)).toBe(true)
  })

  it('ignores the edit paths of trees with similar paths', async () => {
    const pagesSchema = createSiteSchema({ editable: true }).components.pages
    const { admin, findField } = await mountForm({
      schema: {
        components: {
          pages: pagesSchema,
          drafts: { ...pagesSchema, label: 'Drafts', path: 'pages-drafts' }
        }
      },
      data: { ...site, drafts: [{ title: 'Blog', subpages: [] }] }
    })
    await admin.navigate('/items/1/pages-drafts/0')
    const hasForm = name =>
      findField(name).find('.dito-tree-form-container').exists()
    expect(hasForm('drafts')).toBe(true)
    expect(hasForm('pages')).toBe(false)
  })

  it('passes the data path of the value to `render()` of properties', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.properties = {
      slug: { render: ({ dataPath }) => dataPath }
    }
    schema.components.pages.children.collapsed = false
    const { findField } = await mountForm({ schema, data: site })
    expect(
      findField('pages')
        .findAll('.dito-properties td:last-child')
        .map(cell => cell.text())
    ).toEqual(['pages/0/subpages/0/slug', 'pages/0/subpages/1/slug'])
  })

  it('shows loaded dates in properties as their type formats them', async () => {
    const schema = createSiteSchema()
    Object.assign(schema.components.pages.children, {
      form: {
        ...pageForm,
        components: { ...pageForm.components, published: { type: 'date' } }
      },
      properties: { published: {} },
      collapsed: false
    })
    const { findField } = await mountForm({
      schema,
      data: {
        pages: [
          {
            title: 'About',
            subpages: [{ title: 'Team', published: '2026-06-01' }]
          }
        ]
      }
    })
    expect(
      findField('pages').find('.dito-properties td:last-child').text()
    ).toBe('June 1, 2026')
  })

  it('disables the edit buttons of disabled trees', async () => {
    const schema = createSiteSchema({ disabled: true, draggable: true })
    Object.assign(schema.components.pages.children, {
      deletable: true,
      draggable: true
    })
    schema.components.pages.collapsed = false
    const { findField } = await mountForm({ schema, data: site })
    const field = findField('pages')
    const removeButtons = field.findAll('.dito-button--remove')
    const dragHandles = field.findAll('.dito-button--drag')
    // The removable subpages, and the draggable pages and subpages:
    expect(removeButtons).toHaveLength(2)
    expect(dragHandles).toHaveLength(4)
    for (const button of removeButtons) {
      expect(button.element.disabled).toBe(true)
    }
    for (const handle of dragHandles) {
      expect(handle.classes()).toContain('dito-button--disabled')
    }
  })

  describe('reordering', () => {
    function createDraggableSiteSchema() {
      const schema = createSiteSchema({ draggable: true })
      Object.assign(schema.components.pages.children, {
        editable: true,
        deletable: true,
        draggable: true
      })
      schema.components.pages.collapsed = false
      return schema
    }

    function findHandle(field, label) {
      return findButton(field, label, '.dito-button--drag')
    }

    it('moves children with their drag handles by keyboard', async () => {
      const { findField, data, routeComponent } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      expect(routeComponent.routeContext.isDirty).toBe(false)
      await findHandle(findField('pages'), 'Team').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(data.pages[0].subpages).toEqual([
        { title: 'History' },
        { title: 'Team' }
      ])
      expect(routeComponent.routeContext.isDirty).toBe(true)
      await findHandle(findField('pages'), 'Contact').trigger('keydown', {
        key: 'ArrowUp',
        altKey: true
      })
      await flushPromises()
      expect(data.pages.map(page => page.title)).toEqual(['Contact', 'About'])
    })

    it('keeps the form of a moved child open at its new index', async () => {
      const { admin, findField } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0/subpages/0')
      const push = vi.spyOn(admin.router, 'push')
      const replace = vi.spyOn(admin.router, 'replace')
      await findHandle(findField('pages'), 'Team').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/0/subpages/1'
      )
      expect(push.mock.calls.length + replace.mock.calls.length).toBe(1)
      // Moving the parent moves the form of its child along:
      await findHandle(findField('pages'), 'About').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/1/subpages/1'
      )
    })

    it('edits other children in the form when navigating to them', async () => {
      const { admin } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0/subpages/0')
      const form = admin.getRouteComponent()
      await admin.navigate('/items/1/pages/0/subpages/1')
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/0/subpages/1'
      )
      expect(admin.getRouteComponent()).toBe(form)
      expect(form.data.title).toBe('History')
    })

    it('keeps the form of a child on it when its parent moves', async () => {
      const { admin, findField } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0/subpages/1')
      const form = admin.getRouteComponent()
      await enterValue(
        admin.wrapper.find('input[name="pages/0/subpages/1/title"]'),
        'Archive'
      )
      const push = vi.spyOn(admin.router, 'push')
      const replace = vi.spyOn(admin.router, 'replace')
      await findHandle(findField('pages'), 'About').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/1/subpages/1'
      )
      expect(push.mock.calls.length + replace.mock.calls.length).toBe(1)
      expect(admin.getRouteComponent()).toBe(form)
      expect(form.data.title).toBe('Archive')
    })

    it('keeps the children moved while their parent form is open', async () => {
      const { admin, findField, data, settle } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0')
      await settle()
      await findHandle(findField('pages'), 'Team').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(data.pages[0].subpages).toEqual([
        { title: 'History' },
        { title: 'Team' }
      ])
    })

    it('keeps the form of a later child open when removing one', async () => {
      stubConfirm()
      const { admin, findField, data } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0/subpages/1')
      await findButton(findField('pages'), 'Team', '.dito-button--remove')
        .trigger('click')
      await flushPromises()
      expect(data.pages[0].subpages).toEqual([{ title: 'History' }])
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/0/subpages/0'
      )
    })

    it('keeps the form of an earlier child open when removing one', async () => {
      stubConfirm()
      const { admin, findField, data } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0/subpages/0')
      const push = vi.spyOn(admin.router, 'push')
      await findButton(findField('pages'), 'History', '.dito-button--remove')
        .trigger('click')
      await flushPromises()
      expect(data.pages[0].subpages).toEqual([{ title: 'Team' }])
      expect(push).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/0/subpages/0'
      )
    })

    it('closes the form of a removed child', async () => {
      stubConfirm()
      const { admin, findField } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await admin.navigate('/items/1/pages/0/subpages/0')
      await findButton(findField('pages'), 'Team', '.dito-button--remove')
        .trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it('reorders the children of tree objects in the object', async () => {
      const { admin, findField, data, routeComponent } = await mountForm({
        schema: {
          components: {
            site: {
              type: 'tree-object',
              children: {
                name: 'pages',
                path: 'pages',
                itemLabel: 'title',
                form: pageForm,
                draggable: true
              }
            }
          }
        },
        data: {
          site: {
            title: 'Home',
            pages: [{ title: 'About' }, { title: 'Contact' }]
          }
        }
      })
      // Drag the children into reverse order:
      admin.wrapper
        .findComponent(DitoDraggable)
        .vm.$emit('update:modelValue', [...data.site.pages].reverse())
      await flushPromises()
      expect(data.site).toEqual({
        title: 'Home',
        pages: [{ title: 'Contact' }, { title: 'About' }]
      })
      expect(routeComponent.routeContext.isDirty).toBe(true)
      await findHandle(findField('site'), 'Contact').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(data.site).toEqual({
        title: 'Home',
        pages: [{ title: 'About' }, { title: 'Contact' }]
      })
    })
  })

  describe('editing children in nested forms', () => {
    const siteSchema = {
      components: {
        site: {
          type: 'tree-object',
          children: {
            name: 'pages',
            path: 'pages',
            itemLabel: 'title',
            form: pageForm,
            editable: true,
            children: {
              name: 'subpages',
              path: 'subpages',
              itemLabel: 'title',
              form: pageForm,
              editable: true
            }
          }
        }
      }
    }

    const siteData = {
      site: {
        pages: [
          { title: 'About', subpages: [{ title: 'Team' }] },
          { title: 'Contact', subpages: [] }
        ]
      }
    }

    it.each([
      {
        type: 'tree list',
        schema: createSiteSchema({ editable: true }),
        data: site,
        name: 'pages',
        pagesPath: 'pages'
      },
      {
        type: 'tree object',
        schema: siteSchema,
        data: siteData,
        name: 'site',
        pagesPath: 'site/pages'
      }
    ])(
      'edits the children of a $type in their forms',
      async ({ schema, data, name, pagesPath }) => {
        const result = await mountForm({ schema, data })
        const { admin, findField, settle } = result
        await findButton(findField(name), 'Contact', '.dito-button--edit')
          .trigger('click')
        await settle()
        expect(admin.router.currentRoute.value.path).toBe(
          `/items/1/${pagesPath}/1`
        )
        const pageFormComponent = admin.getRouteComponent(isForm)
        expect(pageFormComponent.data.title).toBe('Contact')
        await enterValue(
          admin.wrapper.find(`input[name="${pagesPath}/1/title"]`),
          'Imprint'
        )
        await admin.wrapper
          .find('.dito-buttons--main button[type="submit"]')
          .trigger('click')
        await settle()
        expect(admin.router.currentRoute.value.path).toBe('/items/1')
        expect(getValueAtDataPath(result.data, `${pagesPath}/1/title`)).toBe(
          'Imprint'
        )
        expect(getLabels(findField(name))).toEqual(['About', 'Imprint'])
      }
    )

    it.each([
      {
        type: 'tree list',
        schema: createSiteSchema({ editable: true }),
        data: site,
        name: 'pages',
        pagesPath: 'pages'
      },
      {
        type: 'tree object',
        schema: siteSchema,
        data: siteData,
        name: 'site',
        pagesPath: 'site/pages'
      }
    ])(
      'keeps the children of a $type item when applying its form',
      async ({ schema, data, name, pagesPath }) => {
        const result = await mountForm({
          schema,
          data,
          request: ({ data }) => ({ data: { id: 1, ...data } })
        })
        const { admin, findField, settle, submit } = result
        const subpages = getValueAtDataPath(data, `${pagesPath}/0/subpages`)
        await admin.navigate(`/items/1/${pagesPath}/0`)
        await settle()
        await enterValue(
          admin.wrapper.find(`input[name="${pagesPath}/0/title"]`),
          'Company'
        )
        await admin.wrapper
          .find('.dito-buttons--main button[type="submit"]')
          .trigger('click')
        await settle()
        expect(admin.router.currentRoute.value.path).toBe('/items/1')
        expect(getValueAtDataPath(result.data, `${pagesPath}/0`)).toEqual({
          title: 'Company',
          subpages
        })
        await findField(name).findAll('.dito-tree-branch')[0].trigger('click')
        await flushPromises()
        expect(getLabels(findField(name))).toEqual([
          'Company',
          ...subpages.map(page => page.title),
          'Contact'
        ])
        const submittedData = await submit()
        expect(getValueAtDataPath(submittedData, `${pagesPath}/0`)).toEqual({
          title: 'Company',
          subpages
        })
      }
    )

    it('opens the grandchildren of tree objects with `collapsed: false`', async () => {
      const schema = structuredClone(siteSchema)
      schema.components.site.children.collapsed = false
      const { findField } = await mountForm({ schema, data: siteData })
      expect(getLabels(findField('site'))).toEqual(['About', 'Team', 'Contact'])
    })

    it('reopens the children of tree objects in the edit path', async () => {
      const schema = structuredClone(siteSchema)
      schema.components.site.children.collapsed = false
      const { admin, findField, settle } = await mountForm({
        schema,
        data: siteData
      })
      const about = findField('site').findAll('.dito-tree-branch')[0]
      await about.trigger('click')
      await flushPromises()
      expect(about.attributes('aria-expanded')).toBe('false')
      expect(getLabels(findField('site'))).toEqual(['About', 'Contact'])
      await admin.navigate('/items/1/site/pages/0/subpages/0')
      await settle()
      expect(about.attributes('aria-expanded')).toBe('true')
      expect(getLabels(findField('site'))).toEqual(['About', 'Team', 'Contact'])
    })

    it('adds no child routes to tree lists without forms', async () => {
      const schema = createSiteSchema()
      delete schema.components.pages.form
      schema.components.pages.children.editable = true
      const { admin, findField } = await mountForm({ schema, data: site })
      const paths = admin.router.getRoutes().map(route => route.path)
      expect(paths.filter(path => path.includes('/pages'))).toEqual([])
      // Without routes, the edit buttons of the children are disabled:
      const buttons = findField('pages').findAll('.dito-button--edit')
      expect(
        buttons.map(button => button.attributes('aria-disabled'))
      ).toEqual(['true', 'true'])
    })

    function getActiveLabels(field) {
      return field
        .findAll('.dito-tree-item--active > .dito-tree-header .dito-tree-label')
        .map(label => label.text())
    }

    it('opens the forms of the descendants of tree objects', async () => {
      const { admin, findField, settle } = await mountForm({
        schema: siteSchema,
        data: siteData
      })
      expect(getLabels(findField('site'))).toEqual(['About', 'Contact'])
      expect(getActiveLabels(findField('site'))).toEqual([])
      await admin.navigate('/items/1/site/pages/0/subpages/0')
      await settle()
      const pageFormComponent = admin.getRouteComponent(isForm)
      expect(pageFormComponent.data.title).toBe('Team')
      // The items in the edit path open, and only the edited one is active:
      expect(getLabels(findField('site'))).toEqual(['About', 'Team', 'Contact'])
      expect(getActiveLabels(findField('site'))).toEqual(['Team'])
    })

    it.each([
      {
        type: 'view',
        schema: siteSchema,
        data: siteData,
        name: 'site',
        path: '/test/site'
      },
      {
        type: 'single-component view',
        schema: { component: siteSchema.components.site },
        data: { test: siteData.site },
        name: 'test',
        path: '/test'
      }
    ])(
      'opens the forms of the children of tree objects in a $type',
      async ({ schema, data, name, path }) => {
        const { admin, findField, settle } = await mountSchema({ schema, data })
        await findButton(findField(name), 'Contact', '.dito-button--edit')
          .trigger('click')
        await settle()
        expect(admin.router.currentRoute.value.path).toBe(`${path}/pages/1`)
        let pageFormComponent = admin.getRouteComponent(isForm)
        expect(pageFormComponent.data.title).toBe('Contact')
        await admin.navigate(`${path}/pages/0/subpages/0`)
        await settle()
        pageFormComponent = admin.getRouteComponent(isForm)
        expect(pageFormComponent.data.title).toBe('Team')
      }
    )

    describe('of tree objects with forms', () => {
      const siteWithFormSchema = {
        ...siteSchema.components.site,
        form: { type: 'form', components: { name: { type: 'text' } } }
      }

      it('open the forms of their children in single-component views', async () => {
        const { admin, settle } = await mountSchema({
          schema: { component: siteWithFormSchema },
          data: { test: siteData.site }
        })
        await admin.navigate('/test/pages/1')
        await settle()
        const pageFormComponent = admin.getRouteComponent(isForm)
        expect(pageFormComponent?.data.title).toBe('Contact')
      })

      it(`don't add their own child routes to the routes of children`, async () => {
        const { admin } = await mountSchema({
          schema: { components: { site: siteWithFormSchema } },
          data: siteData
        })
        const paths = admin.router
          .getRoutes()
          .map(route => route.path.replace(/:\w+/g, ':id'))
        expect(paths).toContain('/test/site/pages/:id')
        expect(paths).not.toContain('/test/site/pages/:id/pages')
      })
    })

    it('opens the forms of the children of tree lists in a single-component view', async () => {
      const schema = createSiteSchema({ editable: true })
      schema.components.pages.children.editable = true
      const { admin, findField, settle } = await mountSchema({
        schema: { component: schema.components.pages },
        data: { test: site.pages }
      })
      await findButton(findField('test'), 'Contact', '.dito-button--edit')
        .trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/test/1')
      let pageFormComponent = admin.getRouteComponent(isForm)
      expect(pageFormComponent.data.title).toBe('Contact')
      await admin.navigate('/test/0/subpages/1')
      await settle()
      pageFormComponent = admin.getRouteComponent(isForm)
      expect(pageFormComponent.data.title).toBe('History')
    })
  })
})
