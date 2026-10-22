import { mountAdmin, isForm } from '../test/mount.js'
import { DitoView, DitoForm, DitoFormEmbedded } from '../components/index.js'

const createForm = (fields = {}) => ({
  type: 'form',
  fields: { title: { type: 'text' }, ...fields }
})

const createList = (options = {}) => ({
  type: 'list',
  editable: true,
  form: createForm(),
  ...options
})

const createListView = (path, options = {}) => ({
  type: 'view',
  field: createList({ resource: { path }, ...options })
})

// Returns the route components that render `path`, with `items` as the data
// of the items that forms load by their path, e.g. `/books/1`.
async function getRouteComponents(
  views,
  path,
  items = {}
) {
  const admin = await mountAdmin({
    views,
    request: ({ url }) => ({
      data: items[url] ?? (/\/\d+$/.test(url) ? { id: 1 } : [])
    })
  })
  await admin.navigate(path)
  return admin.getRouteComponents().map(component => component.$.type)
}

describe('RouteTree', () => {
  it('routes the forms of the items of single-component views', async () => {
    expect(
      await getRouteComponents({ books: createListView('books') }, '/books/1')
    ).toEqual([DitoView, DitoForm])
  })

  it('routes the lists of multi-component views under their path', async () => {
    const views = {
      shelf: {
        type: 'view',
        fields: { books: createList({ resource: { path: 'books' } }) }
      }
    }
    expect(await getRouteComponents(views, '/shelf/books/1')).toEqual([
      DitoView,
      DitoForm
    ])
    // Paths of lists without an item lead back to their view:
    const admin = await mountAdmin({ views, request: () => ({ data: [] }) })
    await admin.navigate('/shelf/books')
    expect(admin.router.currentRoute.value.path).toBe('/shelf')
  })

  it('routes views in menus under the path of the menu', async () => {
    const views = {
      catalog: {
        type: 'menu',
        label: 'Catalog',
        items: { books: createListView('books') }
      }
    }
    expect(await getRouteComponents(views, '/catalog/books/1')).toEqual([
      DitoView,
      DitoView,
      DitoForm
    ])
  })

  it('routes the forms of nested lists inside the forms of their items', async () => {
    const views = {
      books: createListView('books', {
        form: createForm({ chapters: createList() })
      })
    }
    expect(await getRouteComponents(views, '/books/1/chapters/2')).toEqual([
      DitoView,
      DitoForm,
      DitoForm
    ])
  })

  it('routes the forms of object sources with and without `create`', async () => {
    const views = {
      books: createListView('books', {
        form: createForm({
          cover: { type: 'object', editable: true, form: createForm() }
        })
      })
    }
    for (const path of ['/books/1/cover', '/books/1/cover/create']) {
      expect(await getRouteComponents(views, path)).toEqual([
        DitoView,
        DitoForm,
        DitoForm
      ])
    }
  })

  it('routes lists under their component path, also in sections', async () => {
    const views = {
      books: createListView('books', {
        form: createForm({
          contents: {
            type: 'section',
            nested: true,
            fields: { notes: createList() }
          },
          more: { type: 'section', fields: { quotes: createList() } },
          meta: { type: 'object', fields: { sources: createList() } }
        })
      })
    }
    // Objects render their components once they have their data:
    const items = { '/books/1': { id: 1, meta: {} } }
    for (const path of [
      '/books/1/contents/notes/2',
      '/books/1/more/quotes/2',
      '/books/1/meta/sources/2'
    ]) {
      expect(await getRouteComponents(views, path, items)).toEqual([
        DitoView,
        DitoForm,
        DitoForm
      ])
    }
  })

  it('routes lists under their own `path`', async () => {
    const views = {
      books: createListView('books', {
        form: createForm({ appendices: createList({ path: 'extras' }) })
      })
    }
    expect(await getRouteComponents(views, '/books/1/extras/2')).toEqual([
      DitoView,
      DitoForm,
      DitoForm
    ])
    expect(
      await getRouteComponents(views, '/books/1/appendices/2')
    ).toEqual([DitoView, DitoForm])
  })

  it('routes the sources of tabs under the names of their tabs', async () => {
    const views = {
      books: createListView('books', {
        form: {
          type: 'form',
          tabs: {
            info: { type: 'tab', fields: { notes: createList() } },
            pricing: { type: 'tab', fields: { notes: createList() } }
          }
        }
      })
    }
    for (const path of ['/books/1/info/notes/2', '/books/1/pricing/notes/2']) {
      expect(await getRouteComponents(views, path)).toEqual([
        DitoView,
        DitoForm,
        DitoForm
      ])
    }
    expect(await getRouteComponents(views, '/books/1/notes/2')).toEqual([
      DitoView,
      DitoForm
    ])
  })

  it('opens the form of the first source with the same route path', async () => {
    const admin = await mountAdmin({
      views: {
        books: createListView('books', {
          form: createForm({
            appendices: createList({ path: 'extras' }),
            extras: createList()
          })
        })
      },
      request: () => ({ data: { id: 1, appendices: [{}], extras: [{}] } })
    })
    await admin.navigate('/books/1/extras/0')
    const form = admin.getRouteComponent(isForm)
    expect(form.routeContext.claim.location.dataPath).toBe('appendices/0')
  })

  it('routes the nested lists of forms shared by several views', async () => {
    const bookForm = createForm({ chapters: createList() })
    const views = {
      books: createListView('books', { form: bookForm }),
      drafts: createListView('drafts', { form: bookForm })
    }
    for (const path of ['/books/1/chapters/2', '/drafts/1/chapters/2']) {
      expect(await getRouteComponents(views, path)).toEqual([
        DitoView,
        DitoForm,
        DitoForm
      ])
    }
  })

  it.each([
    { place: 'in their fields', tab: null },
    { place: 'in a tab', tab: 'more' }
  ])(
    'routes forms that contain themselves up to `maxDepth` times $place',
    async ({ tab }) => {
      const categoryForm = createForm()
      const subcategories = createList({ form: categoryForm, maxDepth: 2 })
      if (tab) {
        categoryForm.tabs = {
          [tab]: { type: 'tab', fields: { subcategories } }
        }
      } else {
        categoryForm.fields.subcategories = subcategories
      }
      const views = {
        categories: createListView('categories', { form: categoryForm })
      }
      // Forms render their sources once they have their item:
      const category = { subcategories: [{ subcategories: [{}] }] }
      const items = { '/categories/1': { id: 1, subcategories: [category] } }
      const segment = tab ? `${tab}/subcategories/0` : 'subcategories/0'
      const getComponents = depth =>
        getRouteComponents(
          views,
          `/categories/1/${Array(depth).fill(segment).join('/')}`,
          items
        )
      expect(await getComponents(1)).toHaveLength(3)
      expect(await getComponents(2)).toHaveLength(4)
      expect(await getComponents(3)).toHaveLength(4)
    }
  )

  describe('inlined content', () => {
    // Content items of several types with inlined style objects, each with
    // nested content that uses the same forms again, like the blocks of
    // articles. `createItemComponents()` adds components to each item form.
    function createArticlesView(
      createItemComponents = () => ({})
    ) {
      const contentForms = {}
      const createContent = () => ({
        type: 'list',
        inlined: true,
        forms: contentForms
      })
      const createStyle = () => ({
        type: 'object',
        fields: { top: { type: 'number' }, bottom: { type: 'number' } }
      })
      for (const type of ['text', 'image', 'quote', 'grid', 'row', 'column']) {
        contentForms[type] = {
          type: 'form',
          fields: {
            padding: createStyle(),
            border: createStyle(),
            [`${type}Content`]: createContent(),
            ...createItemComponents()
          }
        }
      }
      return createListView('articles', {
        form: createForm({ content: createContent() })
      })
    }

    it('routes the lists with forms inside inlined content', async () => {
      const views = {
        articles: createArticlesView(() => ({ links: createList() }))
      }
      const article = {
        id: 1,
        content: [
          {
            type: 'text',
            textContent: [{ type: 'image' }, { type: 'quote', links: [{}] }]
          }
        ]
      }
      expect(
        await getRouteComponents(
          views,
          '/articles/1/content/0/textContent/1/links/0',
          { '/articles/1': article }
        )
      ).toEqual([DitoView, DitoForm, DitoForm])
    })
  })

  it('routes all levels of trees whose levels use the same form', async () => {
    const pageForm = createForm()
    const views = {
      pages: {
        type: 'view',
        field: {
          type: 'tree-list',
          resource: { path: 'pages' },
          editable: true,
          form: pageForm,
          children: {
            name: 'sections',
            editable: true,
            form: pageForm,
            children: { name: 'paragraphs', editable: true, form: pageForm }
          }
        }
      }
    }
    expect(
      await getRouteComponents(views, '/pages/1/sections/2/paragraphs/3')
    ).toEqual([DitoView, DitoFormEmbedded])
  })

  it('routes the forms of tree children next to the form of their item', async () => {
    const views = {
      pages: {
        type: 'view',
        field: {
          type: 'tree-list',
          resource: { path: 'pages' },
          editable: true,
          form: createForm(),
          children: { name: 'subpages', editable: true, form: createForm() }
        }
      }
    }
    expect(await getRouteComponents(views, '/pages/1')).toEqual([
      DitoView,
      DitoFormEmbedded
    ])
    expect(await getRouteComponents(views, '/pages/1/subpages/2')).toEqual([
      DitoView,
      DitoFormEmbedded
    ])
  })

  it('routes the children of tree objects under the path of the object', async () => {
    const views = {
      sites: createListView('sites', {
        form: createForm({
          site: {
            type: 'tree-object',
            children: { name: 'pages', editable: true, form: createForm() }
          }
        })
      })
    }
    expect(await getRouteComponents(views, '/sites/1/site/pages/2')).toEqual([
      DitoView,
      DitoForm,
      DitoFormEmbedded
    ])
  })

  it('gives the routes of the forms of views names that resolve them', async () => {
    const admin = await mountAdmin({
      views: { books: createListView('books') }
    })
    const { name, params } = admin.router.resolve('/books/1')
    expect(typeof name).toBe('symbol')
    expect(admin.router.resolve({ name, params }).path).toBe('/books/1')
  })
})
