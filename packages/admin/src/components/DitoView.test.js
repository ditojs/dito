import { mountAdmin } from '../test/mount.js'

describe('DitoView', () => {
  it('gives each view its own data', async () => {
    const admin = await mountAdmin({
      views: {
        books: { type: 'view', components: { title: { type: 'text' } } },
        authors: { type: 'view', components: { name: { type: 'text' } } }
      }
    })
    await admin.navigate('/books')
    const booksView = admin.getRouteComponent(it => it.isView)
    booksView.setData({ title: 'Emma' })
    await admin.navigate('/authors')
    const authorsView = admin.getRouteComponent(it => it.isView)
    expect(authorsView).not.toBe(booksView)
    expect(authorsView.data.title).toBe(undefined)
    await admin.navigate('/books')
    const view = admin.getRouteComponent(it => it.isView)
    expect(view).not.toBe(booksView)
    // The new view sets up its data with the defaults again:
    expect(view.data.title).toBe(null)
  })
})
