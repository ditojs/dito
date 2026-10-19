import { vi } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { mountForm, settle, isForm, enterValue } from '../test/mount.js'

describe('ResourceContext', () => {
  const chapterForm = {
    type: 'form',
    fields: { title: { type: 'text' } }
  }

  const mountBook = ({ request = () => ({ data: [] }) } = {}) =>
    mountForm({
      schema: {
        fields: {
          chapters: {
            type: 'list',
            resource: { path: 'chapters' },
            columns: { title: {} },
            form: chapterForm,
            buttons: {
              saveOrder: {
                type: 'submit',
                resource: { path: 'order', method: 'post' }
              }
            }
          },
          notes: {
            type: 'list',
            inlined: true,
            form: { type: 'form', fields: { text: { type: 'text' } } }
          }
        }
      },
      data: { notes: [{ text: 'Late' }] },
      request
    })

  it('is provided by forms and sources with a resource', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    const { resourceContext } = form.routeContext
    const { context, services } = getComponent('chapters')
    expect(context.getResourceUrl(resourceContext.getResource())).toBe(
      '/items/1'
    )
    // The list provides its own to its components:
    const chapters = services.resourceContext
    expect(chapters).not.toBe(resourceContext)
    expect(context.getResourceUrl(chapters.getResource())).toBe(
      '/items/1/chapters'
    )
  })

  // Inlined lists have no resource, so their items see the resource of the
  // form, the nearest one with a resource:
  it('resolves resources in inlined lists against the form', async () => {
    const request = vi.fn(({ url }) => ({
      data: url === '/items/1/notes' ? ['Late'] : []
    }))
    const { routeComponent: form, getComponent } = await mountBook({ request })
    expect(getComponent('notes').services.resourceContext).toBe(
      form.routeContext.resourceContext
    )
    const { context } = getComponent('notes/0/text')
    expect(context.getResourceUrl()).toBe('/items/1')
    expect(context.getResourceUrl({ path: 'notes' })).toBe('/items/1/notes')
    expect(await context.request({ resource: { path: 'notes' } })).toEqual([
      'Late'
    ])
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: '/items/1/notes' })
    )
  })

  // Lists in the items of inlined lists continue the resource of the form,
  // like the lists next to them:
  it('continues the form in lists of inlined items', async () => {
    const { getComponent } = await mountForm({
      schema: {
        fields: {
          notes: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              fields: {
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

  it('submits the buttons of sources through their resource', async () => {
    const request = vi.fn(({ method = 'get', url }) => ({
      data:
        method === 'get'
          ? url === '/items/1/chapters'
            ? [{ id: 1, title: 'One' }]
            : { id: 1 }
          : null
    }))
    const { findField, settle } = await mountBook({ request })
    await findField('chapters')
      .find('.dito-buttons button[type="submit"]')
      .trigger('click')
    await settle()
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'post',
        url: '/items/1/chapters/order'
      })
    )
  })

  describe('in forms without a resource', () => {
    // Opens the transient form of the first note, rendered in its own route:
    const openNoteForm = async () => {
      const result = await mountForm({
        schema: {
          fields: {
            notes: {
              type: 'list',
              editable: true,
              deletable: true,
              columns: { text: {} },
              form: {
                type: 'form',
                fields: { text: { type: 'text' } }
              }
            }
          }
        },
        data: { notes: [{ text: 'Late' }] },
        request: vi.fn(() => ({ data: null }))
      })
      await result.admin.navigate('/items/1/notes/0')
      const form = result.admin.getRouteComponent(isForm)
      await settle(form)
      return { ...result, form }
    }

    it('continues the resource of the parent form', async () => {
      const { admin, form, routeComponent: parent } = await openNoteForm()
      expect(form.routeContext.resourceContext).toBe(
        parent.routeContext.resourceContext
      )
      const { context } = admin.getSchemaComponent(form)
      expect(context.getResourceUrl()).toBe('/items/1')
    })

    it('applies the data of the form to its parent', async () => {
      const { form, data, request } = await openNoteForm()
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input[name$="text"]'), 'Later')
      await settle(form)
      const button = element.find('.dito-buttons--main button[type="submit"]')
      expect(button.attributes('aria-label')).toBe('Apply')
      await button.trigger('click')
      await settle(form)
      expect(data.notes).toEqual([{ text: 'Later' }])
      expect(request).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: 'patch' })
      )
    })

    it('names the transient verbs', async () => {
      const { form, getComponent } = await openNoteForm()
      expect(form.routeContext.verbs).toMatchObject({
        submit: 'apply',
        delete: 'remove'
      })
      expect(getComponent('notes').sourceContext.verbs.delete).toBe(
        'remove'
      )
    })
  })

  it('names the verbs of sources with and without a resource', async () => {
    const { routeComponent: form, getComponent } = await mountBook()
    expect(form.routeContext.verbs.delete).toBe('delete')
    expect(getComponent('chapters').sourceContext.verbs.delete).toBe(
      'delete'
    )
    expect(getComponent('notes').sourceContext.verbs.delete).toBe('remove')
  })

  // The forms of tree items render inside the tree, but continue the resource
  // of the parent form, like the tree does.
  it('is continued by the forms of tree items from their route', async () => {
    const { admin, request } = await mountForm({
      schema: {
        fields: {
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
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/items/1/pages/3' })
    )
    expect(form.data.title).toBe('About')
  })
})
