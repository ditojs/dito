import { flushPromises } from '@vue/test-utils'
import { DataContext, DialogContext } from './DataContext.ts'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  isForm
} from '../test/mount.js'

describe('DataContext', () => {
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
    const dataContext = view.ownDataContext
    expect(dataContext).toBeInstanceOf(DataContext)
    expect(view.$refs.schema.dataContext).toBe(dataContext)
    expect(getComponent('title').context.isDirty).toBe(false)
    expect(dataContext.model).toBe(view.dataModel)
    expect(dataContext.isCreating).toBe(false)
  })

  it('tells the state of the data reactively', async () => {
    const { routeComponent: form, wrapper } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const dataContext = form.ownDataContext
    expect(dataContext.isDirty).toBe(false)
    expect(dataContext.isEdited).toBe(false)
    wrapper.find('input[name="title"]').setValue('Persuasion')
    await flushPromises()
    expect(dataContext.isDirty).toBe(true)
    expect(dataContext.isEdited).toBe(true)
  })

  it('is provided by nested forms for their items', async () => {
    const { admin, routeComponent: parent } = await mountForm({
      schema: chaptersSchema,
      data: { chapters: [{ title: 'Arrakis' }] }
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    const dataContext = form.ownDataContext
    expect(dataContext).not.toBe(parent.ownDataContext)
    expect(dataContext.model).not.toBe(parent.ownDataContext.model)
    expect(form.$refs.schema.dataContext).toBe(dataContext)
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
    expect(form.ownDataContext).not.toBe(parent.ownDataContext)
    expect(form.ownDataContext.model).toBe(parent.ownDataContext.model)
  })

  it('is provided by dialogs, which it closes', async () => {
    const admin = await mountAdmin({ views: {} })
    const promise = admin.context.showDialog({
      components: { title: { type: 'text' } },
      buttons: { cancel: {} }
    })
    await flushPromises()
    const dialog = admin.wrapper.findComponent({ name: 'DitoDialog' }).vm
    const { dataContext } = dialog.$refs.schema
    expect(dataContext).toBeInstanceOf(DialogContext)
    expect(dataContext.model.data).toBe(dialog.dialogData)
    dataContext.close('closed')
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
    const { dataContext } = panel.$refs.schema
    expect(dataContext).not.toBe(view.ownDataContext)
    expect(dataContext.model.data).toBe(panel.panelData)
  })
})
