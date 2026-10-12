import {
  mountForm,
  mountSchema,
  settle,
  isView,
  isForm
} from '../test/mount.js'

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
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    return form
  }

  it('is provided by views and forms to their components', async () => {
    const { admin, routeComponent: form, getComponent } = await mountChapters()
    const view = admin.getRouteComponent(isView)
    const { routeContext } = form
    expect(getComponent('chapters').services.routeContext).toBe(routeContext)
    expect(routeContext.parent).toBe(view.routeContext)
    expect(view.routeContext.parent).toBe(null)
    expect(routeContext.level).toBe(1)
    expect(routeContext.isForm).toBe(true)
    expect(view.routeContext.isForm).toBe(false)
    expect(routeContext.dataContext).toBe(form.dataContext)
    expect(routeContext.path).toBe('/items/1')
    expect(routeContext.isLastRoute).toBe(true)
    expect(view.routeContext.isLastRoute).toBe(false)
  })

  it('holds the data that the route renders in its data context', async () => {
    const { admin, routeComponent: form } = await mountChapters()
    const view = admin.getRouteComponent(isView)
    expect(view.routeContext.dataContext.schema).toBe(view.schema)
    expect(view.routeContext.dataContext.data).toBe(view.data)
    const chapterForm = await openChapterForm(admin, '/items/1/chapters/0')
    const { routeContext } = chapterForm
    const { dataContext } = routeContext
    expect(dataContext.schema).toBe(chapterForm.schema)
    expect(dataContext.dataPath).toBe('chapters/0')
    expect(dataContext.componentPath).toBe('chapters/0')
    expect(dataContext.model.rootData.chapters[0]).toBe(chapterForm.data)
    // Forms track their requests along with the ones of their view:
    expect(routeContext.loadingTracker).toBe(view.routeContext.loadingTracker)
    expect(form.routeContext.loadingTracker).toBe(
      view.routeContext.loadingTracker
    )
  })

  it('tells the state that the routes below it depend on', async () => {
    const { admin, routeComponent: form } = await mountChapters()
    expect(form.routeContext.state).toEqual({
      data: form.data,
      routeParams: { id1: '1' },
      isTransient: false
    })
    const chapterForm = await openChapterForm(admin, '/items/1/chapters/create')
    expect(chapterForm.routeContext.state.isTransient).toBe(true)
  })

  it('resolves the form of the item at the data path', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.routeContext.getFormRoute('chapters/0/title')).toEqual({
      path: '/items/1/chapters/0',
      dataPath: 'title'
    })
  })

  it('resolves to null without a form for the data path', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.routeContext.getFormRoute('unknown/path')).toBe(null)
  })

  it('resolves the path of the form that creates an item', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.routeContext.getCreatePath('chapters')).toBe(
      '/items/1/chapters/create'
    )
    expect(form.routeContext.getCreatePath('unknown')).toBe(null)
  })

  it('closes forms by navigating to their parent', async () => {
    const { admin } = await mountChapters()
    const form = await openChapterForm(admin, '/items/1/chapters/0')
    await form.routeContext.close()
    expect(admin.router.currentRoute.value.path).toBe('/items/1')
  })

  it('fails to close views', async () => {
    const { routeComponent: view } = await mountSchema({
      schema: { components: { title: { type: 'text' } } }
    })
    expect(() => view.routeContext.close()).toThrow(
      'Unable to close the route: Views cannot be closed.'
    )
  })
})
