import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { getValueAtDataPath } from '@ditojs/utils'
import {
  mountForm,
  mountSchema,
  stubConfirm,
  enterValue
} from '../test/mount.js'

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

describe('DitoTypeTreeList', () => {
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

  it('opens all items with `open`', async () => {
    const schema = createSiteSchema()
    schema.components.pages.open = true
    schema.components.pages.children.open = true
    const { findField } = await mountForm({ schema, data: site })
    expect(getLabels(findField('pages'))).toEqual([
      'About',
      'Team',
      'History',
      'Contact'
    ])
  })

  it('renders the `properties` of the items', async () => {
    const schema = createSiteSchema()
    schema.components.pages.children.properties = {
      slug: {
        label: 'Slug',
        render: ({ item }) => item.title.toLowerCase()
      }
    }
    schema.components.pages.children.open = true
    const { findField } = await mountForm({ schema, data: site })
    const properties = findField('pages')
      .findAll('.dito-properties')
      .map(table => table.text())
    expect(properties).toEqual([
      expect.stringContaining('team'),
      expect.stringContaining('history')
    ])
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
    schema.components.pages.children.open = true
    const { findField } = await mountForm({ schema, data: site })
    expect(
      findField('pages')
        .findAll('.dito-properties td:last-child')
        .map(cell => cell.text())
    ).toEqual(['pages/0/subpages/0/slug', 'pages/0/subpages/1/slug'])
  })

  it('disables the edit buttons of disabled trees', async () => {
    const schema = createSiteSchema({ disabled: true, draggable: true })
    Object.assign(schema.components.pages.children, {
      deletable: true,
      draggable: true
    })
    schema.components.pages.open = true
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
      schema.components.pages.open = true
      return schema
    }

    function findHandle(field, label) {
      return findButton(field, label, '.dito-button--drag')
    }

    it('moves children with their drag handles by keyboard', async () => {
      const { findField, data } = await mountForm({
        schema: createDraggableSiteSchema(),
        data: site
      })
      await findHandle(findField('pages'), 'Team').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(data.pages[0].subpages).toEqual([
        { title: 'History' },
        { title: 'Team' }
      ])
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
      await findHandle(findField('pages'), 'Team').trigger('keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/pages/0/subpages/1'
      )
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
      const { admin, findField, data } = await mountForm({
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
        .findComponent({ name: 'DitoDraggable' })
        .vm.$emit('update:modelValue', [...data.site.pages].reverse())
      await flushPromises()
      expect(data.site).toEqual({
        title: 'Home',
        pages: [{ title: 'Contact' }, { title: 'About' }]
      })
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
        const pageFormComponent = admin.getRouteComponent(it => it.isForm)
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

    it('opens the grandchildren of tree objects with `open`', async () => {
      const schema = structuredClone(siteSchema)
      schema.components.site.children.open = true
      const { findField } = await mountForm({ schema, data: siteData })
      expect(getLabels(findField('site'))).toEqual(['About', 'Team', 'Contact'])
    })

    it('adds no child routes to tree lists without forms', async () => {
      const schema = createSiteSchema()
      delete schema.components.pages.form
      schema.components.pages.children.editable = true
      const { admin, getComponent } = await mountForm({ schema, data: site })
      const paths = admin.router.getRoutes().map(route => route.path)
      expect(paths.filter(path => path.includes('/pages'))).toEqual([])
      // Without routes, the forms of the children aren't editable in the tree:
      expect(getComponent('pages').hasEditableForms).toBe(false)
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
      const pageFormComponent = admin.getRouteComponent(it => it.isForm)
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
        let pageFormComponent = admin.getRouteComponent(it => it.isForm)
        expect(pageFormComponent.data.title).toBe('Contact')
        await admin.navigate(`${path}/pages/0/subpages/0`)
        await settle()
        pageFormComponent = admin.getRouteComponent(it => it.isForm)
        expect(pageFormComponent.data.title).toBe('Team')
      }
    )
  })
})
