import {
  mountForm,
  mountSchema,
  settle,
  enterValue,
  isForm
} from '../test/mount.js'

describe('SourceContext', () => {
  const pageForm = {
    type: 'form',
    components: { title: { type: 'text' } }
  }

  const openForm = async (admin, path) => {
    await admin.navigate(path)
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    return form
  }

  it('is provided by sources to the components of their items', async () => {
    const { getComponent } = await mountSchema({
      schema: {
        components: {
          chapters: {
            type: 'list',
            inlined: true,
            form: pageForm
          },
          title: { type: 'text' }
        }
      },
      data: { chapters: [{ title: 'Arrakis' }] }
    })
    const chapters = getComponent('chapters')
    const source = chapters.ownSourceContext
    expect(source.schema).toBe(chapters.schema)
    expect(source.dataPath).toBe('chapters')
    expect(getComponent('chapters/0/title').context.listQuery).toBe(
      source.query
    )
    expect(getComponent('title').context.listQuery).toBe(null)
  })

  it('provides the query of lists as `listQuery`', async () => {
    const { getComponent } = await mountSchema({
      schema: {
        components: {
          books: {
            type: 'list',
            resource: { path: 'books' },
            scopes: { all: {}, published: {} },
            columns: { title: {} },
            buttons: { export: { type: 'button' } }
          }
        }
      },
      request: () => ({ data: [] })
    })
    const books = getComponent('books')
    expect(books.ownSourceContext.query).toEqual({ scope: 'all' })
    expect(getComponent('books/export').context.listQuery).toBe(
      books.ownSourceContext.query
    )
  })

  // The forms of tree items render inside the tree, but their components
  // aren't in the tree's list.
  it(`isn't continued by the forms of tree items`, async () => {
    const { admin, getComponent } = await mountForm({
      schema: {
        components: {
          pages: {
            type: 'tree-list',
            itemLabel: 'title',
            form: pageForm
          }
        }
      },
      data: { pages: [{ title: 'About' }] }
    })
    expect(getComponent('pages').context.listQuery).not.toBe(null)
    const form = await openForm(admin, '/items/1/pages/0')
    const title = admin.getComponent(form, 'pages/0/title')
    expect(title.context.listQuery).toBe(null)
    // Nor the callbacks of the form's schema:
    expect(form.$refs.schema.context.listQuery).toBe(null)
  })

  it('reloads the list of a saved item in the parent form', async () => {
    const chapters = [{ id: 7, title: 'Arrakis' }]
    const { admin, request } = await mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            resource: { path: 'chapters' },
            editable: true,
            columns: { title: {} },
            form: pageForm
          }
        }
      },
      data: { title: 'Dune' },
      request: ({ method = 'get', url, data }) =>
        method === 'get' && url === '/items/1/chapters'
          ? { data: chapters }
          : method === 'get' && url === '/items/1/chapters/7'
            ? { data: chapters[0] }
            : { data }
    })
    const form = await openForm(admin, '/items/1/chapters/7')
    const countChapterLoads = () =>
      request.mock.calls.filter(
        ([{ method = 'get', url }]) => (
          method === 'get' && url === '/items/1/chapters'
        )
      ).length
    const loads = countChapterLoads()
    const { wrapper } = admin
    await enterValue(wrapper.find('input[name="title"]'), 'Dune')
    await wrapper
      .find('.dito-buttons--main button[type="submit"]')
      .trigger('click')
    await settle(form)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'patch', url: '/items/1/chapters/7' })
    )
    expect(countChapterLoads()).toBe(loads + 1)
  })
})
