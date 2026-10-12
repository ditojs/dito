import { flushPromises } from '@vue/test-utils'
import { ContainerContext, DialogContext } from './ContainerContext.ts'
import { mountAdmin, mountForm, mountSchema, settle } from '../test/mount.js'

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
    const { container } = view
    expect(container).toBeInstanceOf(ContainerContext)
    expect(getComponent('title').container).toBe(container)
    expect(container.model).toBe(view.dataModel)
    expect(container.isCreating).toBe(false)
  })

  it('tells the state of the data reactively', async () => {
    const { routeComponent: form, wrapper } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const { container } = form
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
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    const { container } = form
    expect(container).not.toBe(parent.container)
    expect(container.model).not.toBe(parent.container.model)
    expect(
      admin.getComponent(form, 'chapters/0/title').container
    ).toBe(container)
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
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    expect(form.container).not.toBe(parent.container)
    expect(form.container.model).toBe(parent.container.model)
  })

  it('is provided by dialogs, which it closes', async () => {
    const admin = await mountAdmin({ views: {} })
    const promise = admin.context.showDialog({
      components: { title: { type: 'text' } },
      buttons: { cancel: {} }
    })
    await flushPromises()
    const dialog = admin.wrapper.findComponent({ name: 'DitoDialog' }).vm
    const { container } = dialog
    expect(container).toBeInstanceOf(DialogContext)
    expect(admin.getComponent(dialog, 'title').container)
      .toBe(container)
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
    const { container } = panel
    expect(container).not.toBe(view.container)
    expect(container.model).toBe(panel.dataModel)
    expect(panel.$refs.schema.container).toBe(container)
  })
})
