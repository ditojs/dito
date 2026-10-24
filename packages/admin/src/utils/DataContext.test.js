import { vi } from 'vitest'
import { computed } from 'vue'
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
    fields: {
      chapters: {
        type: 'list',
        form: {
          type: 'form',
          fields: { title: { type: 'text' } }
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
      schema: { fields: { title: { type: 'text' } } },
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
      schema: { fields: { title: { type: 'text' } } },
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
        fields: {
          chapters: {
            ...chaptersSchema.fields.chapters,
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
      fields: { title: { type: 'text' } },
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
      views: { books: { type: 'view', fields: {} } }
    })
    await admin.navigate('/books')
    const promise = admin.context.showDialog({
      fields: {
        speed: {
          type: 'panel',
          data: { mode: 'fast' },
          fields: { mode: { type: 'text' } }
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
        fields: {
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
        schema: { fields: { title: { type: 'text', required: true } } },
        data: { title: '' }
      })
      expect(routeComponent.dataContext.validate()).toBe(false)
      await flushPromises()
      expect(getErrors('title')).toEqual(['The title field is required.'])
      expect(dataModel.errors.getDataPaths()).toEqual(['title'])
      dataModel.errors.clear()
      await flushPromises()
      expect(getErrors('title')).toEqual([])
    })

    it('hides the errors of values that code changed', async () => {
      const { routeComponent, getErrors, data, dataModel } = await mountSchema(
        {
          schema: { fields: { title: { type: 'text', required: true } } },
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
      expect(dataModel.errors.getDataPaths()).toEqual([])
    })

    it('replaces only the errors of matching fields', async () => {
      const { routeComponent, getErrors, data } = await mountSchema({
        schema: {
          fields: {
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
          fields: {
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
          fields: {
            title: { type: 'text', required: true },
            address: {
              type: 'section',
              nested: true,
              fields: {
                city: { type: 'text', required: true },
                zip: { type: 'text', required: true }
              }
            },
            chapters: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                fields: { title: { type: 'text', required: true } }
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
      expect(dataModel.errors.getDataPaths()).toHaveLength(5)
      context.clearErrors()
      expect(dataModel.errors.getDataPaths()).toEqual([])
    })

    it('clears the errors at matching data paths and beneath', async () => {
      const { context, dataModel } = await mountInvalidSchema()
      context.clearErrors(['title', 'address'])
      expect(dataModel.errors.getDataPaths()).toEqual([
        'chapters/0/title',
        'chapters/1/title'
      ])
      context.clearErrors(/^chapters\/1$/)
      expect(dataModel.errors.getDataPaths()).toEqual(['chapters/0/title'])
    })

    it('matches data paths with wildcards', async () => {
      const { context, dataModel } = await mountInvalidSchema()
      expect(context.isValid('chapters.*.title')).toBe(false)
      expect(context.isValid('*.title')).toBe(true)
      context.clearErrors('chapters/*/title')
      context.clearErrors('address/**')
      expect(dataModel.errors.getDataPaths()).toEqual(['title'])
    })
  })

  describe('getErrors()', () => {
    const mountInvalidSchema = async () => {
      const result = await mountSchema({
        schema: {
          fields: {
            title: { type: 'text', required: true },
            address: {
              type: 'section',
              nested: true,
              fields: {
                city: { type: 'text', required: true },
                zip: { type: 'text' }
              }
            }
          }
        },
        data: { title: '', address: { city: '', zip: '' } }
      })
      return { ...result, context: result.schemaComponent.context }
    }

    const required = [{ message: 'is required' }]

    it('is null without errors', async () => {
      const { context } = await mountInvalidSchema()
      // Invalid data has no errors until they are shown:
      expect(context.getErrors()).toBe(null)
      context.validate()
      context.clearErrors()
      expect(context.getErrors()).toBe(null)
    })

    it('tells the errors that validation shows, by data path', async () => {
      const { context } = await mountInvalidSchema()
      context.validate()
      expect(context.getErrors()).toEqual({
        'title': required,
        'address/city': required
      })
    })

    it('matches data paths like validate()', async () => {
      const { context } = await mountInvalidSchema()
      context.validate()
      expect(context.getErrors('title')).toEqual({ title: required })
      expect(context.getErrors(['title', 'address/city'])).toEqual({
        'title': required,
        'address/city': required
      })
      expect(context.getErrors('address/**')).toEqual({
        'address/city': required
      })
      expect(context.getErrors(/^address\//)).toEqual({
        'address/city': required
      })
      expect(context.getErrors(dataPath => dataPath === 'title')).toEqual({
        title: required
      })
      expect(context.getErrors('address/zip')).toBe(null)
    })

    it('updates reactively when errors are cleared', async () => {
      const { context, data } = await mountInvalidSchema()
      const errors = computed(() => context.getErrors())
      context.validate()
      expect(errors.value).toEqual({
        'title': required,
        'address/city': required
      })
      data.title = 'Emma'
      expect(errors.value).toEqual({ 'address/city': required })
      context.clearErrors('address')
      expect(errors.value).toBe(null)
    })

    it('tells the keywords and parameters of server errors', async () => {
      const { routeComponent, context } = await mountInvalidSchema()
      const error = {
        message: 'must be at least 3 characters long',
        keyword: 'minLength',
        params: { limit: 3 }
      }
      await routeComponent.dataContext.showValidationErrors({
        'address/zip': [error]
      })
      expect(context.getErrors()).toEqual({ 'address/zip': [error] })
    })

    it('tells the errors of several fields of the same value once', async () => {
      const { context } = await mountSchema({
        schema: {
          fields: {
            title: { type: 'text', required: true },
            heading: {
              type: 'section',
              fields: { title: { type: 'text' } }
            }
          }
        },
        data: { title: '' }
      }).then(result => ({ context: result.schemaComponent.context }))
      context.validate()
      expect(context.getErrors()).toEqual({ title: required })
    })

    it('tells errors inside values by their data paths', async () => {
      const { routeComponent } = await mountSchema({
        schema: {
          fields: {
            address: {
              type: 'code',
              formatValue: ({ value }) => JSON.stringify(value),
              parseValue: ({ value }) => JSON.parse(value)
            }
          }
        },
        data: { address: { city: 'Bath' } }
      })
      const { dataContext } = routeComponent
      await dataContext.showValidationErrors({
        'address/street': [{ message: 'is required' }]
      })
      expect(dataContext.getErrors()).toEqual({ 'address/street': required })
    })
  })

  describe('showValidationErrors()', () => {
    it('replaces the errors, and notifies them once', async () => {
      const { routeComponent, admin, getErrors } = await mountSchema({
        schema: {
          fields: { title: { type: 'text' }, author: { type: 'text' } }
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
          fields: {
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
