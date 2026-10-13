import type { RouteTree } from './RouteTree.ts'
import { mountAdmin } from '../test/mount.js'
import { DitoView, DitoForm, DitoFormEmbedded } from '../components/index.js'

const createForm = (
  components: Record<string, any> = {}
): { type: 'form'; components: Record<string, any> } => ({
  type: 'form',
  components: { title: { type: 'text' }, ...components }
})

const createList = (options: Record<string, any> = {}) => ({
  type: 'list',
  editable: true,
  form: createForm(),
  ...options
})

const createListView = (path: string, options: Record<string, any> = {}) => ({
  type: 'view',
  component: createList({ resource: { path }, ...options })
})

// Returns the route components that render `path`, or `redirect` for records
// that redirect, or `null` if no route matches.
async function getRouteComponents(views: Record<string, any>, path: string) {
  const admin = await mountAdmin({ views })
  const { matched } = admin.router.resolve(path)
  return matched[0]?.name === 'catch-all'
    ? null
    : matched.map(record =>
        record.redirect ? 'redirect' : record.components?.default
      )
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
        components: { books: createList({ resource: { path: 'books' } }) }
      }
    }
    expect(await getRouteComponents(views, '/shelf/books/1')).toEqual([
      DitoView,
      DitoForm
    ])
    expect(await getRouteComponents(views, '/shelf/books')).toEqual([
      DitoView,
      'redirect'
    ])
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

  it('routes lists under their data path, also in nested containers', async () => {
    const views = {
      books: createListView('books', {
        form: createForm({
          contents: {
            type: 'section',
            nested: true,
            components: { notes: createList() }
          },
          more: { type: 'section', components: { quotes: createList() } },
          meta: { type: 'object', components: { sources: createList() } }
        })
      })
    }
    for (const path of [
      '/books/1/contents/notes/2',
      '/books/1/quotes/2',
      '/books/1/meta/sources/2'
    ]) {
      expect(await getRouteComponents(views, path)).toEqual([
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
    expect(await getRouteComponents(views, '/books/1/appendices/2')).toBe(null)
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

  it('routes forms that contain themselves up to `maxDepth` times', async () => {
    const categoryForm = createForm()
    categoryForm.components.subcategories = createList({
      form: categoryForm,
      maxDepth: 2
    })
    const views = {
      categories: createListView('categories', { form: categoryForm })
    }
    expect(
      await getRouteComponents(views, '/categories/1/subcategories/2')
    ).toHaveLength(3)
    expect(
      await getRouteComponents(
        views,
        '/categories/1/subcategories/2/subcategories/3'
      )
    ).toHaveLength(4)
    expect(
      await getRouteComponents(
        views,
        '/categories/1/subcategories/2/subcategories/3/subcategories/4'
      )
    ).toBe(null)
  })

  describe('inlined content', () => {
    // Content items of several types with inlined style objects, each with
    // nested content that uses the same forms again, like the blocks of
    // articles. `createItemComponents()` adds components to each item form.
    function createArticlesView(
      createItemComponents: () => Record<string, any> = () => ({})
    ) {
      const contentForms: Record<string, any> = {}
      const createContent = () => ({
        type: 'list',
        inlined: true,
        forms: contentForms
      })
      const createStyle = () => ({
        type: 'object',
        components: { top: { type: 'number' }, bottom: { type: 'number' } }
      })
      for (const type of ['text', 'image', 'quote', 'grid', 'row', 'column']) {
        contentForms[type] = {
          type: 'form',
          components: {
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

    async function countNodes(views: Record<string, any>) {
      const admin = await mountAdmin({ views })
      // `mountAdmin()` waits for the views, so they have their route tree:
      const routeTree = admin.context.routeTree!
      let count = 0
      const countNode = (node: { children: any[] }) => {
        count++
        node.children.forEach(countNode)
      }
      routeTree.nodes.forEach(countNode)
      return count
    }

    it('adds no nodes for inlined sources without routes below', async () => {
      // The view, its list and its form:
      expect(await countNodes({ articles: createArticlesView() })).toBe(3)
    })

    it('routes the lists with forms inside inlined content', async () => {
      const views = {
        articles: createArticlesView(() => ({ links: createList() }))
      }
      expect(await countNodes(views)).toBeLessThan(500)
      expect(
        await getRouteComponents(
          views,
          '/articles/1/content/0/textContent/1/links/2'
        )
      ).toEqual([DitoView, DitoForm, DitoForm])
    })
  })

  it('routes all levels of trees whose levels use the same form', async () => {
    const pageForm = createForm()
    const views = {
      pages: {
        type: 'view',
        component: {
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
        component: {
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

  it('gives the routes of forms unique names that resolve them', async () => {
    const admin = await mountAdmin({
      views: {
        books: createListView('books', {
          form: createForm({ chapters: createList() })
        })
      }
    })
    const { name, params } = admin.router.resolve('/books/1/chapters/2')
    expect(typeof name).toBe('symbol')
    expect(admin.router.resolve({ name: name!, params }).path).toBe(
      '/books/1/chapters/2'
    )
  })
})
