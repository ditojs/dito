import { RouteContext } from './RouteContext.ts'
import { mountForm, mountSchema, settle } from '../test/mount.js'

describe('RouteContext', () => {
  const mountChapters = () =>
    mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            creatable: true,
            form: {
              type: 'form',
              components: { title: { type: 'text' } }
            }
          }
        }
      },
      data: { chapters: [{ title: 'Arrakis' }] }
    })

  const openChapterForm = async (admin, path) => {
    await admin.navigate(path)
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    return form
  }

  it('is provided by views and forms to their components', async () => {
    const { admin, routeComponent: form, getComponent } = await mountChapters()
    const view = admin.getRouteComponent(component => component.isView)
    const { route } = form
    expect(route).toBeInstanceOf(RouteContext)
    expect(getComponent('chapters').route).toBe(route)
    expect(route.parent).toBe(view.route)
    expect(view.route.parent).toBe(null)
    expect(route.level).toBe(1)
    expect(route.isForm).toBe(true)
    expect(view.route.isForm).toBe(false)
    expect(route.container).toBe(form.container)
    expect(route.path).toBe('/items/1')
    expect(route.isLastRoute).toBe(true)
    expect(view.route.isLastRoute).toBe(false)
  })

  it('describes the data that the route renders', async () => {
    const { admin, routeComponent: form } = await mountChapters()
    const view = admin.getRouteComponent(component => component.isView)
    expect(view.route.schema).toBe(view.schema)
    expect(view.route.rootData).toBe(view.data)
    const chapterForm = await openChapterForm(admin, '/items/1/chapters/0')
    const { route } = chapterForm
    expect(route.schema).toBe(chapterForm.schema)
    expect(route.dataPath).toBe('chapters/0')
    expect(route.componentPath).toBe('chapters/0')
    expect(route.rootData.chapters[0]).toBe(chapterForm.data)
    // Forms track their requests along with the ones of their view:
    expect(route.loadingTracker).toBe(view.loadingTracker)
    expect(form.route.loadingTracker).toBe(view.loadingTracker)
  })

  it('tells the state that the routes below it depend on', async () => {
    const { admin, routeComponent: form } = await mountChapters()
    expect(form.route.state).toEqual({
      data: form.data,
      routeParams: { id1: '1' },
      isTransient: false
    })
    const chapterForm = await openChapterForm(admin, '/items/1/chapters/create')
    expect(chapterForm.route.state.isTransient).toBe(true)
  })

  it('resolves the form of the item at the data path', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.route.getFormRoute('chapters/0/title')).toEqual({
      path: '/items/1/chapters/0',
      dataPath: 'title'
    })
  })

  it('resolves to null without a form for the data path', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.route.getFormRoute('unknown/path')).toBe(null)
  })

  it('resolves the path of the form that creates an item', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.route.getCreatePath('chapters')).toBe(
      '/items/1/chapters/create'
    )
    expect(form.route.getCreatePath('unknown')).toBe(null)
  })

  it('closes forms by navigating to their parent', async () => {
    const { admin } = await mountChapters()
    const form = await openChapterForm(admin, '/items/1/chapters/0')
    await form.route.close()
    expect(admin.router.currentRoute.value.path).toBe('/items/1')
  })

  it('fails to close views', async () => {
    const { routeComponent: view } = await mountSchema({
      schema: { components: { title: { type: 'text' } } }
    })
    expect(() => view.route.close()).toThrow(
      'Unable to close the route: Views cannot be closed.'
    )
  })
})
