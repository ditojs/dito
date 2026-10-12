import { flushPromises } from '@vue/test-utils'
import { ContainerContext, DialogContext } from './ContainerContext.ts'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  isForm
} from '../test/mount.js'

describe('ContainerContext', () => {
  const chaptersSchema = {
    components: {
      chapters: {
        type: 'list',
        form: {
          type: 'form',
          components: { title: { type: 'text' } }
        }
      }
    }
  }

  it('is provided by views to the components of their data', async () => {
    const { routeComponent: view, getComponent } = await mountSchema({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const container = view.ownContainer
    expect(container).toBeInstanceOf(ContainerContext)
    expect(view.$refs.schema.container).toBe(container)
    expect(getComponent('title').context.isDirty).toBe(false)
    expect(container.model).toBe(view.dataModel)
    expect(container.isCreating).toBe(false)
  })

  it('tells the state of the data reactively', async () => {
    const { routeComponent: form, wrapper } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const container = form.ownContainer
    expect(container.isDirty).toBe(false)
    expect(container.isEdited).toBe(false)
    wrapper.find('input[name="title"]').setValue('Persuasion')
    await flushPromises()
    expect(container.isDirty).toBe(true)
    expect(container.isEdited).toBe(true)
  })

  it('is provided by nested forms for their items', async () => {
    const { admin, routeComponent: parent } = await mountForm({
      schema: chaptersSchema,
      data: { chapters: [{ title: 'Arrakis' }] }
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    const container = form.ownContainer
    expect(container).not.toBe(parent.ownContainer)
    expect(container.model).not.toBe(parent.ownContainer.model)
    expect(form.$refs.schema.container).toBe(container)
  })

  it('holds the data of mutating forms in the model of the parent', async () => {
    const { admin, routeComponent: parent } = await mountForm({
      schema: {
        components: {
          chapters: {
            ...chaptersSchema.components.chapters,
            mutate: true
          }
        }
      },
      data: { chapters: [{ title: 'Arrakis' }] }
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(form.ownContainer).not.toBe(parent.ownContainer)
    expect(form.ownContainer.model).toBe(parent.ownContainer.model)
  })

  it('is provided by dialogs, which it closes', async () => {
    const admin = await mountAdmin({ views: {} })
    const promise = admin.context.showDialog({
      components: { title: { type: 'text' } },
      buttons: { cancel: {} }
    })
    await flushPromises()
    const dialog = admin.wrapper.findComponent({ name: 'DitoDialog' }).vm
    const { container } = dialog.$refs.schema
    expect(container).toBeInstanceOf(DialogContext)
    expect(container.model.data).toBe(dialog.dialogData)
    container.close('closed')
    expect(await promise).toBe('closed')
  })

  it('is provided by panels with their own data', async () => {
    const { wrapper, routeComponent: view } = await mountSchema({
      schema: {
        components: {
          recipes: {
            type: 'list',
            resource: { path: 'recipes' },
            filters: { title: { filter: 'text' } },
            columns: { title: {} }
          }
        }
      },
      request: () => ({ data: { results: [], total: 0 } })
    })
    const panel = wrapper.findComponent({ name: 'DitoPanel' }).vm
    const { container } = panel.$refs.schema
    expect(container).not.toBe(view.ownContainer)
    expect(container.model.data).toBe(panel.panelData)
  })
})
