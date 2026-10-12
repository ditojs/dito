import { ResourceContext } from './ResourceContext.ts'
import { mountForm, settle, isForm } from '../test/mount.js'

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
    const { resource } = form.ownRoute
    expect(resource).toBeInstanceOf(ResourceContext)
    const { getResourceUrl } = getComponent('chapters').context
    expect(getResourceUrl(resource.getResource())).toBe('/items/1')
    const chapters = getComponent('chapters').ownSource.resource
    expect(chapters).not.toBe(resource)
    expect(chapters.parent).toBe(resource)
    expect(getResourceUrl(chapters.getResource())).toBe('/items/1/chapters')
    // The items of the notes see the resource of the notes, which continues
    // the one of the form:
    expect(getComponent('notes/0/text').context.getResourceUrl()).toBe(
      '/items/1'
    )
  })

  it('resolves resources through the closest one with a resource', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    const notes = getComponent('notes').ownSource.resource
    expect(notes.getResource()).toBe(null)
    expect(notes.resourceOwner).toBe(form.ownRoute.resource)
    const { getResourceUrl } = getComponent('notes/0/text').context
    expect(getResourceUrl({ path: 'notes' })).toBe('/items/1/notes')
  })

  // Inlined lists have no resource, so lists in their items continue the
  // resource of the form, like the lists next to them:
  it('continues the form in lists of inlined items', async () => {
    const { getComponent } = await mountForm({
      schema: {
        components: {
          notes: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              components: {
                links: {
                  type: 'list',
                  resource: { path: 'links' },
                  columns: { url: {} }
                }
              }
            }
          }
        }
      },
      data: { notes: [{}] },
      request: () => ({ data: [] })
    })
    const { context } = getComponent('notes/0/links')
    expect(context.getResourceUrl()).toBe('/items/1/links')
  })

  it('names the verbs of transient sources', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    expect(form.ownRoute.resource.verbs.delete).toBe('delete')
    expect(getComponent('notes').ownSource.resource.verbs.delete).toBe('remove')
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
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(form.ownRoute.resource.parent).toBe(parent.ownRoute.resource)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/items/1/pages/3' })
    )
    expect(form.data.title).toBe('About')
  })
})
