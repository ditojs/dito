import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  isForm
} from '../test/mount.js'
import DitoDialog from '../components/DitoDialog.vue'
import DitoPanel from '../components/DitoPanel.vue'
import DitoSchema from '../components/DitoSchema.vue'
import DitoTextType from '../types/DitoTextType.vue'

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
    const {
      admin,
      routeComponent: view,
      getComponent
    } = await mountSchema({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const { dataContext } = view
    expect(admin.getSchemaComponent(view)).not.toBe(null)
    expect(getComponent('title').services.dataContext).toBe(dataContext)
    expect(getComponent('title').context.isDirty).toBe(false)
    expect(dataContext.model.data).toBe(view.data)
    expect(dataContext.isCreating).toBe(false)
  })

  it('tells the state of the data reactively', async () => {
    const { routeComponent: form, wrapper } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    const dataContext = form.dataContext
    expect(dataContext.isDirty).toBe(false)
    wrapper.find('input[name="title"]').setValue('Persuasion')
    await flushPromises()
    expect(dataContext.isDirty).toBe(true)
  })

  it('is provided by nested forms for their items', async () => {
    const { admin, routeComponent: parent } = await mountForm({
      schema: chaptersSchema,
      data: { chapters: [{ title: 'Arrakis' }] }
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    const dataContext = form.dataContext
    expect(dataContext).not.toBe(parent.dataContext)
    expect(dataContext.model).not.toBe(parent.dataContext.model)
    expect(admin.getSchemaComponent(form)).not.toBe(null)
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
    expect(form.dataContext).not.toBe(parent.dataContext)
    expect(form.dataContext.model).toBe(parent.dataContext.model)
  })

  it('is provided by dialogs, which it closes', async () => {
    const admin = await mountAdmin({ views: {} })
    const promise = admin.context.showDialog({
      components: { title: { type: 'text' } },
      buttons: { cancel: {} }
    })
    await flushPromises()
    const dialog = admin.wrapper.findComponent(DitoDialog)
    const { dataContext } = dialog.findComponent(DitoSchema).vm
    expect(dataContext.model.data).toBe(dialog.vm.dialogData)
    dataContext.closeDialog('closed')
    expect(await promise).toBe('closed')
  })

  it('closes dialogs from panels with their own data in them', async () => {
    const admin = await mountAdmin({
      views: { books: { type: 'view', components: {} } }
    })
    await admin.navigate('/books')
    const promise = admin.context.showDialog({
      components: {
        speed: {
          type: 'panel',
          data: { mode: 'fast' },
          components: { mode: { type: 'text' } }
        }
      },
      buttons: { cancel: {} }
    })
    await flushPromises()
    const mode = admin.wrapper
      .findAllComponents(DitoTextType)
      .find(({ vm }) => vm.componentPath === 'speed/mode').vm
    mode.context.closeDialog(mode.context.item.mode)
    expect(await promise).toBe('fast')
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
    const panel = wrapper.findComponent(DitoPanel)
    const { dataContext } = panel.findComponent(DitoSchema).vm
    expect(dataContext).not.toBe(view.dataContext)
    expect(dataContext.model.data).toBe(panel.vm.panelData)
  })

  describe('validate()', () => {
    it('shows the errors until they are cleared', async () => {
      const { routeComponent, getErrors, dataModel } = await mountSchema({
        schema: { components: { title: { type: 'text', required: true } } },
        data: { title: '' }
      })
      expect(routeComponent.dataContext.validate()).toBe(false)
      await flushPromises()
      expect(getErrors('title')).toEqual(['The title field is required.'])
      expect(dataModel.getErrorDataPaths()).toEqual(['title'])
      dataModel.clearErrors()
      await flushPromises()
      expect(getErrors('title')).toEqual([])
    })

    it('hides the errors of values that code changed', async () => {
      const { routeComponent, getErrors, data, dataModel } = await mountSchema(
        {
          schema: { components: { title: { type: 'text', required: true } } },
          data: { title: '' }
        }
      )
      routeComponent.dataContext.validate()
      await flushPromises()
      expect(getErrors('title')).toEqual(['The title field is required.'])
      data.title = 'Emma'
      await flushPromises()
      expect(getErrors('title')).toEqual([])
      expect(routeComponent.dataContext.validate()).toBe(true)
      expect(dataModel.getErrorDataPaths()).toEqual([])
    })

    it('replaces only the errors of matching fields', async () => {
      const { routeComponent, getErrors, data } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text', required: true },
            author: { type: 'text', required: true }
          }
        },
        data: { title: '', author: '' }
      })
      const { dataContext } = routeComponent
      dataContext.validate()
      await flushPromises()
      data.title = 'Emma'
      expect(dataContext.validate('title')).toBe(true)
      await flushPromises()
      expect(getErrors('title')).toEqual([])
      expect(getErrors('author')).toEqual(['The author field is required.'])
    })
  })

  describe('verify()', () => {
    it('verifies matching data silently', async () => {
      const { routeComponent, getErrors } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text', required: true },
            author: { type: 'text', required: true }
          }
        },
        data: { title: 'Emma', author: '' }
      })
      expect(routeComponent.dataContext.verify()).toBe(false)
      expect(routeComponent.dataContext.verify('title')).toBe(true)
      expect(routeComponent.dataContext.verify(/^author$/)).toBe(false)
      // Unlike `validate()`, no errors are shown:
      expect(getErrors('author')).toEqual([])
      expect(routeComponent.dataContext.validate('author')).toBe(false)
      await flushPromises()
      expect(getErrors('author')).toEqual(['The author field is required.'])
    })
  })

  describe('clearErrors()', () => {
    const mountInvalidSchema = async () => {
      const result = await mountSchema({
        schema: {
          components: {
            title: { type: 'text', required: true },
            address: {
              type: 'section',
              nested: true,
              components: {
                city: { type: 'text', required: true },
                zip: { type: 'text', required: true }
              }
            },
            chapters: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                components: { title: { type: 'text', required: true } }
              }
            }
          }
        },
        data: {
          title: '',
          address: { city: '', zip: '' },
          chapters: [{ title: '' }, { title: '' }]
        }
      })
      const { context } = result.schemaComponent
      context.validate()
      await flushPromises()
      return { ...result, context }
    }

    it('clears all errors without a match', async () => {
      const { context, dataModel } = await mountInvalidSchema()
      expect(dataModel.getErrorDataPaths()).toHaveLength(5)
      context.clearErrors()
      expect(dataModel.getErrorDataPaths()).toEqual([])
    })

    it('clears the errors at matching data paths and beneath', async () => {
      const { context, dataModel } = await mountInvalidSchema()
      context.clearErrors(['title', 'address'])
      expect(dataModel.getErrorDataPaths()).toEqual([
        'chapters/0/title',
        'chapters/1/title'
      ])
      context.clearErrors(/^chapters\/1$/)
      expect(dataModel.getErrorDataPaths()).toEqual(['chapters/0/title'])
    })

    it('matches data paths with wildcards', async () => {
      const { context, dataModel } = await mountInvalidSchema()
      expect(context.isValid('chapters.*.title')).toBe(false)
      expect(context.isValid('*.title')).toBe(true)
      context.clearErrors('chapters/*/title')
      context.clearErrors('address/**')
      expect(dataModel.getErrorDataPaths()).toEqual(['title'])
    })
  })

  describe('showValidationErrors()', () => {
    it('replaces the errors, and notifies them once', async () => {
      const { routeComponent, admin, getErrors } = await mountSchema({
        schema: {
          components: { title: { type: 'text' }, author: { type: 'text' } }
        },
        data: { title: 'Emma', author: 'Jane' }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await routeComponent.dataContext.showValidationErrors({
        title: [{ message: 'is taken' }]
      })
      await routeComponent.dataContext.showValidationErrors({
        author: [{ message: 'is unknown' }]
      })
      await flushPromises()
      expect(getErrors('title')).toEqual([])
      expect(getErrors('author')).toEqual(['The author field is unknown.'])
      expect(notify).toHaveBeenCalledTimes(2)
      // Without errors, there's nothing to notify:
      await routeComponent.dataContext.showValidationErrors({})
      expect(notify).toHaveBeenCalledTimes(2)
      vi.restoreAllMocks()
    })
  })

  describe('errors inside values', () => {
    it('shows them on the field of the value', async () => {
      const { routeComponent, admin, getErrors } = await mountSchema({
        schema: {
          components: {
            address: {
              type: 'code',
              formatValue: ({ value }) => JSON.stringify(value),
              parseValue: ({ value }) => JSON.parse(value)
            }
          }
        },
        data: { address: { city: 'Bath' } }
      })
      const notify = vi.spyOn(admin.context, 'notify')
      await routeComponent.dataContext.showValidationErrors({
        'address/street': [{ message: 'is required' }]
      })
      await flushPromises()
      expect(getErrors('address')).toEqual([
        `The address field's street is required.`
      ])
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Please correct the highlighted errors.'
        })
      )
      vi.restoreAllMocks()
    })
  })
})
