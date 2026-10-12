import { ResourceContext } from './ResourceContext.ts'
import { mountForm, settle } from '../test/mount.js'

describe('ResourceContext', () => {
  const chapterForm = {
    type: 'form',
    components: { title: { type: 'text' } }
  }

  const mountBook = () =>
    mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            resource: { path: 'chapters' },
            columns: { title: {} },
            form: chapterForm
          },
          notes: {
            type: 'list',
            inlined: true,
            form: { type: 'form', components: { text: { type: 'text' } } }
          }
        }
      },
      data: { notes: [{ text: 'Late' }] },
      request: () => ({ data: [] })
    })

  it('is provided by forms and sources to their components', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    const { resource } = form
    expect(resource).toBeInstanceOf(ResourceContext)
    expect(form.getResourceUrl(resource.getResource())).toBe('/items/1')
    const chapters = getComponent('chapters')
    expect(chapters.resource).not.toBe(resource)
    expect(chapters.resource.parent).toBe(resource)
    expect(form.getResourceUrl(chapters.resource.getResource())).toBe(
      '/items/1/chapters'
    )
    expect(getComponent('notes/0/text').resource).toBe(
      getComponent('notes').resource
    )
  })

  it('resolves resources through the closest one with a resource', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    const notes = getComponent('notes')
    expect(notes.resource.getResource()).toBe(null)
    expect(notes.resource.resourceOwner).toBe(form.resource)
    expect(getComponent('notes/0/text').getResourceUrl({ path: 'notes' }))
      .toBe('/items/1/notes')
  })

  it('names the verbs of transient sources', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    expect(form.resource.verbs.delete).toBe('delete')
    expect(getComponent('notes').resource.verbs.delete).toBe('remove')
    expect(getComponent('notes/0/text').verbs.delete).toBe('remove')
  })

  // The forms of tree items render inside the tree, but continue the resource
  // of the parent form, like the tree does.
  it('is continued by the forms of tree items from their route', async () => {
    const {
      admin,
      routeComponent: parent,
      request
    } = await mountForm({
      schema: {
        components: {
          pages: {
            type: 'tree-list',
            resource: { path: 'pages' },
            itemLabel: 'title',
            form: chapterForm
          }
        }
      },
      data: { title: 'Site' },
      request: ({ url }) =>
        url === '/items/1/pages'
          ? { data: [{ id: 3, title: 'About' }] }
          : url === '/items/1/pages/3'
            ? { data: { id: 3, title: 'About' } }
            : null
    })
    await admin.navigate('/items/1/pages/3')
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    expect(form.resource.parent).toBe(parent.resource)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/items/1/pages/3' })
    )
    expect(form.data.title).toBe('About')
  })
})
