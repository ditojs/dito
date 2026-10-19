import { mountAdmin, mountForm, isView, isForm } from '../test/mount.js'

describe('useRouteContainer()', () => {
  it('keeps the routes of the new route by level', async () => {
    const { admin } = await mountForm({
      schema: { fields: { title: { type: 'text' } } },
      data: { title: 'Dune' }
    })
    const { routes } = admin.context.ui
    const view = admin.getRouteComponent(isView)
    const form = admin.getRouteComponent(isForm)
    expect(routes).toEqual([view.routeContext, form.routeContext])
    await admin.navigate('/items')
    expect(form.$.isUnmounted).toBe(true)
    expect(routes).toEqual([view.routeContext])
    await admin.navigate('/items/1')
    const newForm = admin.getRouteComponent(isForm)
    expect(newForm).not.toBe(form)
    expect(routes).toEqual([view.routeContext, newForm.routeContext])
  })

  it('replaces the routes of other views at their level', async () => {
    const admin = await mountAdmin({
      views: {
        books: { type: 'view', fields: { title: { type: 'text' } } },
        authors: { type: 'view', fields: { name: { type: 'text' } } }
      }
    })
    await admin.navigate('/books')
    const view = admin.getRouteComponent(isView)
    await admin.navigate('/authors')
    expect(view.$.isUnmounted).toBe(true)
    const authorsView = admin.getRouteComponent(isView)
    expect(authorsView.name).toBe('authors')
    expect(admin.context.ui.routes).toEqual([authorsView.routeContext])
  })

  it('uses the breadcrumb of the schema', async () => {
    const { admin } = await mountForm({
      schema: {
        label: 'Book',
        breadcrumb: 'Edit Book',
        fields: { title: { type: 'text' } }
      },
      data: { title: 'Emma' }
    })
    expect(admin.context.ui.routes.at(-1).breadcrumb).toBe('Edit Book')
  })
})
