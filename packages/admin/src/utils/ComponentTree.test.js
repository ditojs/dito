import { vi } from 'vitest'
import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, mountForm, mountSchema } from '../test/mount.js'
import DitoContainer from '../components/DitoContainer.vue'
import DitoTreeItem from '../components/DitoTreeItem.vue'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoListField,
  DitoSection
} from '../index.js'

// The component paths of all nodes in the tree:
function getTreePaths(node, paths = []) {
  for (const child of node.children) {
    paths.push(child.componentPath)
    getTreePaths(child, paths)
  }
  return paths
}

// The component paths of the mounted containers in the data of
// `routeComponent`:
function getMountedPaths(wrapper, routeComponent) {
  return wrapper
    .findAllComponents(DitoContainer)
    .map(({ vm }) => vm)
    .filter(vm => vm.field.services.dataContext === routeComponent.dataContext)
    .map(vm => vm.componentPath)
}

describe('ComponentTree', () => {
  const bookSchema = {
    fields: {
      title: { type: 'text' },
      details: {
        type: 'section',
        fields: { subtitle: { type: 'text' } }
      },
      meta: {
        type: 'section',
        nested: true,
        fields: { isbn: { type: 'text' } }
      },
      chapters: {
        type: 'list',
        inlined: true,
        form: {
          type: 'form',
          fields: {
            title: { type: 'text' },
            notes: {
              type: 'list',
              inlined: true,
              form: { type: 'form', fields: { text: { type: 'text' } } }
            }
          }
        }
      },
      author: {
        type: 'object',
        inlined: true,
        form: { type: 'form', fields: { name: { type: 'text' } } },
        panels: {
          bio: { type: 'panel', fields: { born: { type: 'text' } } }
        }
      }
    },
    tabs: {
      more: {
        type: 'tab',
        fields: { title: { type: 'text' }, tagline: { type: 'text' } }
      }
    },
    panels: {
      info: { type: 'panel', fields: { summary: { type: 'text' } } }
    }
  }

  const bookData = {
    title: 'Emma',
    subtitle: 'A Novel',
    meta: { isbn: '978' },
    chapters: [
      { title: 'One', notes: [{ text: 'a' }] },
      { title: 'Two', notes: [{ text: 'b' }, { text: 'c' }] }
    ],
    author: { name: 'Jane' },
    tagline: 'Matchmaking',
    summary: 'Comedy',
    born: '1775'
  }

  it('derives the paths of the mounted components', async () => {
    const { wrapper, routeComponent } = await mountSchema({
      schema: bookSchema,
      data: bookData
    })
    const { componentTree } = routeComponent.dataContext
    const mountedPaths = getMountedPaths(wrapper, routeComponent)
    expect(mountedPaths).toEqual(
      expect.arrayContaining([
        'title',
        'details/subtitle',
        'meta/isbn',
        'chapters/1/notes/1/text',
        'author/name',
        'author/bio/born',
        'more/title',
        'more/tagline',
        'info/summary'
      ])
    )
    expect(getTreePaths(componentTree.root)).toEqual(
      expect.arrayContaining(mountedPaths)
    )
  })

  it('finds the fields that display a value, in form order', async () => {
    const { routeComponent } = await mountSchema({
      schema: bookSchema,
      data: bookData
    })
    const { componentTree } = routeComponent.dataContext
    const getPaths = dataPath =>
      componentTree.getFieldNodes(dataPath).map(node => node.componentPath)
    expect(getPaths('title')).toEqual(['title', 'more/title'])
    expect(getPaths('chapters/1/notes/0/text')).toEqual([
      'chapters/1/notes/0/text'
    ])
    // Field panels display the data of the item around the field:
    expect(getPaths('born')).toEqual(['author/bio/born'])
    expect(getPaths('subtitle')).toEqual(['details/subtitle'])
  })

  it('follows items by their uids when they move', async () => {
    const { routeComponent } = await mountSchema({
      schema: bookSchema,
      data: bookData
    })
    const { componentTree } = routeComponent.dataContext
    const [node] = componentTree.getFieldNodes('chapters/1/title')
    routeComponent.data.chapters.reverse()
    expect(node.componentPath).toBe('chapters/0/title')
    expect(node.dataPath).toBe('chapters/0/title')
  })

  it('leaves out irrelevant and hidden fields', async () => {
    const { routeComponent } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text', if: ({ item }) => item.isPublished },
          code: { type: 'text', visible: false },
          details: {
            type: 'section',
            visible: false,
            fields: { subtitle: { type: 'text' } }
          }
        }
      },
      data: { isPublished: false, title: 'Emma', code: 'E', subtitle: 'A' }
    })
    const { componentTree } = routeComponent.dataContext
    expect(componentTree.getFieldNodes('title')).toEqual([])
    expect(componentTree.getFieldNodes('code')).toEqual([])
    expect(componentTree.getFieldNodes('subtitle')).toEqual([])
    routeComponent.data.isPublished = true
    expect(componentTree.getFieldNodes('title')).toHaveLength(1)
  })

  it('derives the paths of tree items', async () => {
    const chapterForm = {
      type: 'form',
      fields: { title: { type: 'text' } }
    }
    const { wrapper, routeComponent } = await mountForm({
      schema: {
        fields: {
          chapters: {
            type: 'tree-list',
            path: 'chapters',
            itemLabel: 'title',
            form: chapterForm,
            collapsed: false,
            children: {
              name: 'sections',
              path: 'sections',
              itemLabel: 'title',
              form: chapterForm,
              collapsed: false
            }
          }
        }
      },
      data: {
        chapters: [
          { title: 'Intro' },
          { title: 'Main', sections: [{ title: 'Start' }] }
        ]
      }
    })
    const { componentTree } = routeComponent.dataContext
    const mountedPaths = wrapper
      .findAllComponents(DitoTreeItem)
      .map(({ vm }) => vm.componentPath)
    expect(mountedPaths).toEqual([
      'chapters',
      'chapters/0',
      'chapters/1',
      'chapters/1/sections/0'
    ])
    expect(getTreePaths(componentTree.root)).toEqual(
      expect.arrayContaining(mountedPaths)
    )
    expect(
      componentTree
        .getFieldNodes('chapters/1/sections/0/title')
        .map(node => node.componentPath)
    ).toEqual(['chapters/1/sections/0/title'])
  })

  describe('in forms with properties', () => {
    const Page = {
      setup() {
        useDitoForm({
          resource: 'books',
          id: 1,
          properties: {
            title: { type: 'string', required: true },
            address: {
              type: 'object',
              properties: { city: { type: 'string' } }
            },
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: { label: { type: 'string', required: true } }
              }
            }
          }
        })
        return () =>
          h(DitoSchemaForm, null, {
            default: () => [
              h(DitoTextField, { name: 'title' }),
              h(
                DitoSection,
                { name: 'more' },
                { default: () => h(DitoTextField, { name: 'title' }) }
              ),
              h(
                DitoSection,
                { name: 'address', nested: true },
                { default: () => h(DitoTextField, { name: 'city' }) }
              ),
              h(
                DitoListField,
                { name: 'tags' },
                { default: () => h(DitoTextField, { name: 'label' }) }
              )
            ]
          })
      }
    }

    async function mountPage() {
      const admin = await mountAdmin({
        views: {
          book: { type: 'page', label: 'Book', path: 'book', component: Page }
        },
        request: () => ({
          data: {
            id: 1,
            title: 'Emma',
            address: { city: 'Bath' },
            tags: [{ label: 'Novel' }]
          }
        })
      })
      await admin.navigate('/book')
      await flushPromises()
      return admin
    }

    it('attaches the widgets to the nodes of their properties', async () => {
      const { wrapper } = await mountPage()
      const { componentTree } =
        wrapper.findComponent(DitoSchemaForm).vm.form.dataContext
      const getLeafPaths = dataPath =>
        componentTree
          .getFieldNodes(dataPath)
          .flatMap(node => [...node.leaves].map(leaf => leaf.componentPath))
      expect(getLeafPaths('title')).toEqual(['title', 'more/~2/title'])
      expect(getLeafPaths('address/city')).toEqual(['address/city'])
      expect(getLeafPaths('tags/0/label')).toEqual(['tags/0/label'])
    })
  })

  describe('errors', () => {
    it('reveal fields in the items of collapsed sections', async () => {
      const { admin, routeComponent, getErrors } = await mountSchema({
        schema: {
          fields: {
            details: {
              type: 'section',
              collapsible: true,
              collapsed: true,
              fields: {
                chapters: {
                  type: 'list',
                  inlined: true,
                  form: {
                    type: 'form',
                    fields: { title: { type: 'text' } }
                  }
                }
              }
            }
          }
        },
        data: { chapters: [{ title: 'One' }, { title: 'Two' }] }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await routeComponent.dataContext.showValidationErrors({
        'chapters/1/title': [{ message: 'is taken' }]
      })
      await flushPromises()
      expect(getErrors('chapters/1/title')).toEqual([
        'The Title field is taken.'
      ])
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Please correct the highlighted errors.'
        })
      )
      expect(document.activeElement.id).toBe('details/chapters/1/title')
      vi.restoreAllMocks()
    })

    it('focus the first field of the value in form order', async () => {
      const { routeComponent } = await mountSchema({
        schema: {
          fields: { title: { type: 'text' } },
          tabs: {
            more: { type: 'tab', fields: { title: { type: 'text' } } }
          }
        },
        data: { title: 'Emma' }
      })
      await routeComponent.dataContext.showValidationErrors({
        title: [{ message: 'is taken' }]
      })
      await flushPromises()
      expect(document.activeElement.id).toBe('title')
    })

    it('are notified for hidden fields', async () => {
      const { admin, routeComponent } = await mountSchema({
        schema: { fields: { code: { type: 'text', visible: false } } },
        data: { code: 'E' }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await routeComponent.dataContext.showValidationErrors({
        code: [{ message: 'is taken' }]
      })
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'The field Code is taken' })
      )
      vi.restoreAllMocks()
    })
  })
})
