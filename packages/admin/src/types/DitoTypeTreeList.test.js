import { flushPromises } from '@vue/test-utils'
import { mountForm } from '../test/mount.js'

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
})
