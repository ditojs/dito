import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ComponentNode } from './ComponentTree.ts'
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
        fields: {
          chapters: {
            type: 'list',
            creatable: true,
            form: {
              type: 'form',
              fields: { title: { type: 'text' } }
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

  it('tells whether the routes below it edit transient data', async () => {
    const { admin, routeComponent: form } = await mountChapters()
    expect(form.routeContext.isTransient).toBe(false)
    const chapterForm = await openChapterForm(admin, '/items/1/chapters/create')
    expect(chapterForm.routeContext.isTransient).toBe(true)
  })

  it('holds the claim of the form below, which opened it', async () => {
    const { admin, routeComponent: form, getComponent } = await mountChapters()
    expect(form.routeContext.childClaim).toBe(null)
    const chapterForm = await openChapterForm(admin, '/items/1/chapters/0')
    const claim = form.routeContext.childClaim
    expect(claim.path).toBe('/items/1/chapters/0')
    expect(claim.sourcePath).toBe('/items/1/chapters')
    expect(claim.param).toBe('0')
    expect(claim.source).toBe(getComponent('chapters').sourceContext)
    expect(chapterForm.routeContext.claim).toBe(claim)
  })

  it('resolves claims only for the components that claim', async () => {
    const { wrapper, findContainer, findField } = await mountForm({
      schema: {
        fields: {
          details: {
            type: 'section',
            collapsible: true,
            collapsed: true,
            fields: {
              chapters: {
                type: 'list',
                inlined: true,
                fields: { title: { type: 'text' } }
              }
            }
          }
        }
      },
      data: {
        chapters: Array.from({ length: 50 }, (_, index) => ({
          title: `Chapter ${index + 1}`
        }))
      }
    })
    // Count the claims of the nodes, as their cost only shows in their number:
    const claimRoute = vi.spyOn(ComponentNode.prototype, 'claimRoute')
    await findContainer('details')
      .find('.dito-schema-header .dito-label')
      .trigger('click')
    await flushPromises()
    expect(findField('details').findAll('input')).toHaveLength(50)
    // Not once per mounted schema, as only the form's schema can claim:
    expect(wrapper.findAll('.dito-schema').length).toBeGreaterThan(50)
    expect(claimRoute.mock.calls.length).toBeLessThan(5)
    claimRoute.mockRestore()
  })

  it('resolves the form of the item at the component path', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.routeContext.getFormRoute('chapters/0/title')).toEqual({
      path: '/items/1/chapters/0',
      componentPath: 'title'
    })
  })

  it('resolves to null without a form for the data path', async () => {
    const { routeComponent: form } = await mountChapters()
    expect(form.routeContext.getFormRoute('unknown/path')).toBe(null)
  })

  it('closes forms by navigating to their parent', async () => {
    const { admin } = await mountChapters()
    const form = await openChapterForm(admin, '/items/1/chapters/0')
    await form.routeContext.close()
    expect(admin.router.currentRoute.value.path).toBe('/items/1')
  })

  it('fails to close views', async () => {
    const { routeComponent: view } = await mountSchema({
      schema: { fields: { title: { type: 'text' } } }
    })
    expect(() => view.routeContext.close()).toThrow(
      'Unable to close the route: Views cannot be closed.'
    )
  })
})
