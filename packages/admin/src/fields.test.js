import { h, ref, vShow, withDirectives } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import {
  mountForm,
  mountSchema,
  enterValue,
  isForm,
  settle,
  stubConfirm
} from './test/mount.js'
import {
  defineType,
  defineFieldComponent,
  useDitoContext,
  DitoSchemaField,
  DitoDateField,
  DitoListField,
  DitoNumberField,
  DitoObjectField,
  DitoTextField
} from './index.js'

// Mounts a form for a book, whose fields `render()` declares in the template of
// its component, and answers its saves with the data sent:
async function mountTemplateForm(render, { data, schema } = {}) {
  const result = await mountForm({
    schema: {
      label: 'Book',
      component: { props: ['schema', 'context'], render },
      ...schema
    },
    data: data ?? {
      title: 'Emma',
      price: 12,
      notes: 'Not shown',
      address: { city: 'Bath', street: 'Gay Street' },
      chapters: [{ title: 'One' }, { title: 'Two' }]
    },
    request: ({ data }) => ({ data: { id: 1, ...data } })
  })
  const { wrapper, settle } = result
  return {
    ...result,
    findInput: dataPath => wrapper.find(`input[id$="${dataPath}"]`),
    findInputs: () => wrapper.findAll('.dito-text input'),
    async settle() {
      await settle()
      await flushPromises()
    }
  }
}

describe('template forms', () => {
  it('loads, edits and saves the values of their fields', async () => {
    const { data, dataModel, findInput, submit } = await mountTemplateForm(
      () => [
        h(DitoTextField, { path: 'title', required: true }),
        h(DitoNumberField, { path: 'price', min: 0 })
      ]
    )
    expect(findInput('title').element.value).toBe('Emma')
    expect(dataModel.isDirty).toBe(false)
    await enterValue(findInput('title'), 'Persuasion')
    expect(data.title).toBe('Persuasion')
    expect(dataModel.isDirty).toBe(true)
    // Values without a field aren't sent:
    expect(await submit()).toEqual({ id: 1, title: 'Persuasion', price: 12 })
    expect(dataModel.isDirty).toBe(false)
  })

  it('takes the options of their fields from template attributes', async () => {
    // A template compiled at runtime, with Vue's attributes as they come:
    const { findInput, getErrors, submit } = await mountTemplateForm(null, {
      schema: {
        component: {
          components: { DitoTextField },
          props: ['schema', 'context'],
          template: `<DitoTextField path="title" required max-length="5" />`
        }
      }
    })
    expect(findInput('title').attributes('maxlength')).toBe('5')
    await enterValue(findInput('title'), '')
    expect(await submit()).toBe(null)
    expect(getErrors('title')).toEqual(['The Title field is required.'])
  })

  it('validates only the mounted fields', async () => {
    const isShown = ref(true)
    const { findInput, getErrors, submit, settle } = await mountTemplateForm(
      () => [
        h(DitoTextField, { path: 'title', required: true }),
        isShown.value && h(DitoTextField, { path: 'notes', required: true })
      ]
    )
    await enterValue(findInput('title'), '')
    await enterValue(findInput('notes'), '')
    expect(await submit()).toBe(null)
    expect(getErrors('title')).toEqual(['The Title field is required.'])
    expect(getErrors('notes')).toEqual(['The Notes field is required.'])
    isShown.value = false
    await settle()
    await enterValue(findInput('title'), 'Emma')
    // Fields that unmounted are still saved, but not validated:
    expect(await submit()).toEqual({ id: 1, title: 'Emma', notes: null })
  })

  it('validates the fields that are hidden with v-show', async () => {
    const { findContainer, getErrors, submit } = await mountTemplateForm(() =>
      withDirectives(h(DitoTextField, { path: 'notes', required: true }), [
        [vShow, false]
      ])
    )
    expect(findContainer('notes').isVisible()).toBe(false)
    await enterValue(findContainer('notes').find('input'), '')
    expect(await submit()).toBe(null)
    expect(getErrors('notes')).toEqual(['The Notes field is required.'])
  })

  it('reads the props of their fields live', async () => {
    const min = ref(20)
    const { getErrors, submit, settle } = await mountTemplateForm(() =>
      h(DitoNumberField, { path: 'price', min: min.value })
    )
    expect(await submit()).toBe(null)
    expect(getErrors('price')).toEqual(['The Price field must be 20 or more.'])
    min.value = 10
    await settle()
    expect(await submit()).toEqual({ id: 1, price: 12 })
  })

  it('passes the context to the callbacks in props', async () => {
    const { findInput, findContainer } = await mountTemplateForm(() => [
      h(DitoTextField, { path: 'title' }),
      h(DitoTextField, {
        path: 'notes',
        label: ({ item }) => `Notes on ${item.title}`
      })
    ])
    expect(findContainer('notes').find('label').text()).toBe('Notes on Emma')
    await enterValue(findInput('title'), 'Persuasion')
    expect(findContainer('notes').find('label').text()).toBe(
      'Notes on Persuasion'
    )
  })

  it('places dotted paths in the objects of their groups', async () => {
    const { data, findInput, submit } = await mountTemplateForm(() =>
      h(DitoTextField, { path: 'address.city', required: true })
    )
    expect(findInput('address/city').element.value).toBe('Bath')
    await enterValue(findInput('address/city'), 'London')
    expect(data.address.city).toBe('London')
    // Groups send only the values of their fields:
    expect(await submit()).toEqual({ id: 1, address: { city: 'London' } })
  })

  it('lays out the components of forms with `components` too', async () => {
    const { findInput, submit } = await mountTemplateForm(
      () =>
        h('div', { class: 'layout' }, h(DitoSchemaField, { name: 'title' })),
      { schema: { components: { title: { type: 'text' } } } }
    )
    expect(findInput('title').element.value).toBe('Emma')
    expect(await submit()).toEqual({ id: 1, title: 'Emma' })
  })
})

describe('nested template forms', () => {
  it('apply their changes to the data of their parent', async () => {
    const { admin, data } = await mountSchema({
      schema: {
        components: {
          chapters: {
            type: 'list',
            editable: true,
            itemLabel: 'title',
            form: {
              type: 'form',
              label: 'Chapter',
              component: {
                props: ['schema', 'context'],
                render: () =>
                  h(DitoTextField, { path: 'title', required: true })
              }
            }
          }
        }
      },
      data: { chapters: [{ title: 'One', notes: 'Kept' }] }
    })
    await admin.navigate('/test/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    const element = new DOMWrapper(form.$el)
    await enterValue(element.find('input'), 'First')
    await element
      .find('.dito-buttons--main button[type="submit"]')
      .trigger('click')
    await settle(form)
    expect(data.chapters).toEqual([{ title: 'First', notes: 'Kept' }])
  })
})

describe('DitoListField', () => {
  const renderChapters =
    (itemSlot, props = {}) =>
    () =>
      h(
        DitoListField,
        { path: 'chapters', inlined: true, creatable: true, ...props },
        { default: itemSlot }
      )

  it('edits the items with the fields of its slot', async () => {
    const { data, dataModel, findInputs, submit } = await mountTemplateForm(
      renderChapters(() => h(DitoTextField, { path: 'title', required: true }))
    )
    const inputs = findInputs()
    expect(inputs.map(input => input.element.value)).toEqual(['One', 'Two'])
    await enterValue(inputs[1], 'Second')
    expect(data.chapters[1].title).toBe('Second')
    expect(dataModel.isDirty).toBe(true)
    expect(await submit()).toEqual({
      id: 1,
      chapters: [{ title: 'One' }, { title: 'Second' }]
    })
  })

  it('validates the fields of each item', async () => {
    const { findInputs, findContainer, submit } = await mountTemplateForm(
      renderChapters(() => h(DitoTextField, { path: 'title', required: true }))
    )
    await enterValue(findInputs()[1], '')
    expect(await submit()).toBe(null)
    expect(findContainer('chapters/0/title').find('.dito-errors').exists())
      .toBe(false)
    expect(
      findContainer('chapters/1/title')
        .findAll('.dito-errors li')
        .map(item => item.text())
    ).toEqual(['The Title field is required.'])
  })

  it('validates the fields that are mounted in each item', async () => {
    // Only the first item shows its required field:
    const ItemFields = {
      setup() {
        const context = useDitoContext()
        return () => [
          h(DitoTextField, { path: 'title' }),
          context.item.title === 'One' &&
          h(DitoTextField, { path: 'subtitle', required: true })
        ]
      }
    }
    const { findInput, findInputs, submit } = await mountTemplateForm(
      renderChapters(() => h(ItemFields))
    )
    expect(findInputs()).toHaveLength(3)
    expect(await submit()).toBe(null)
    await enterValue(findInput('chapters/0/subtitle'), 'Opening')
    // One schema for all items, with the defaults of its fields:
    expect(await submit()).toEqual({
      id: 1,
      chapters: [
        { title: 'One', subtitle: 'Opening' },
        { title: 'Two', subtitle: null }
      ]
    })
  })

  it('deserializes the values of the items for their fields', async () => {
    const { data } = await mountTemplateForm(
      renderChapters(() => h(DitoDateField, { path: 'date' })),
      { data: { chapters: [{ date: '1815-12-23' }] } }
    )
    expect(data.chapters[0].date).toBeInstanceOf(Date)
  })

  it('takes the schema of the items from their first fields', async () => {
    // Per-item differences need callbacks, as the items share one form:
    const ItemFields = {
      setup() {
        const context = useDitoContext()
        return () =>
          h(DitoTextField, {
            path: 'title',
            label: `Title of ${context.item.title}`
          })
      }
    }
    const { wrapper } = await mountTemplateForm(
      renderChapters(() => h(ItemFields))
    )
    expect(
      wrapper
        .findAll('.dito-list .dito-container label')
        .map(label => label.text())
    ).toEqual(['Title of One', 'Title of One'])
  })

  it('forgets the item fields that unmounted when the data is reset', async () => {
    const isShown = ref(true)
    const { routeComponent, submit, settle } = await mountTemplateForm(
      renderChapters(() => [
        h(DitoTextField, { path: 'title' }),
        isShown.value && h(DitoTextField, { path: 'subtitle' })
      ])
    )
    isShown.value = false
    await settle()
    routeComponent.dataContext.resetItem({ chapters: [{ title: 'Three' }] })
    await settle()
    expect(await submit()).toEqual({ id: 1, chapters: [{ title: 'Three' }] })
  })

  it('adds and removes items', async () => {
    const { wrapper, data, findInputs, submit, settle } =
      await mountTemplateForm(
        renderChapters(() => h(DitoTextField, { path: 'title' }), {
          deletable: true
        })
      )
    stubConfirm(true)
    await wrapper.find('.dito-create-button button').trigger('click')
    await settle()
    expect(data.chapters).toHaveLength(3)
    await enterValue(findInputs()[2], 'Three')
    await wrapper.findAll('.dito-button--remove')[0].trigger('click')
    await settle()
    expect(findInputs().map(input => input.element.value)).toEqual([
      'Two',
      'Three'
    ])
    expect(await submit()).toEqual({
      id: 1,
      chapters: [{ title: 'Two' }, { title: 'Three' }]
    })
  })
})

describe('DitoObjectField', () => {
  it('edits the object with the fields of its slot', async () => {
    const { data, findInput, submit } = await mountTemplateForm(() =>
      h(
        DitoObjectField,
        { path: 'address', inlined: true },
        { default: () => h(DitoTextField, { path: 'city' }) }
      )
    )
    expect(findInput('address/city').element.value).toBe('Bath')
    await enterValue(findInput('address/city'), 'London')
    expect(data.address.city).toBe('London')
    expect(await submit()).toEqual({ id: 1, address: { city: 'London' } })
  })
})

describe('useDitoContext()', () => {
  it('returns the context of the form', async () => {
    let context = null
    const Editor = {
      setup() {
        context = useDitoContext()
        return () => h(DitoTextField, { path: 'title' })
      }
    }
    const { findInput } = await mountTemplateForm(() => h(Editor))
    expect(context.item.title).toBe('Emma')
    expect(context.isDirty).toBe(false)
    await enterValue(findInput('title'), 'Persuasion')
    expect(context.item.title).toBe('Persuasion')
    expect(context.isDirty).toBe(true)
  })
})

describe('defineFieldComponent()', () => {
  it('creates the field components of custom types', async () => {
    const Stars = {
      emits: ['update:modelValue', 'change'],
      props: {
        schema: { type: Object, required: true },
        context: { type: Object, required: true },
        modelValue: { type: Number, default: null }
      },
      render() {
        return h(
          'button',
          {
            class: 'stars',
            onClick: () =>
              this.$emit(
                'update:modelValue',
                Math.min(this.modelValue + 1, this.schema.max)
              )
          },
          '*'.repeat(this.modelValue)
        )
      }
    }
    defineType({ type: 'stars', component: Stars })
    const DitoStarsField = defineFieldComponent('stars')
    expect(DitoStarsField.name).toBe('DitoStarsField')
    const { wrapper, data, submit } = await mountTemplateForm(
      () => h(DitoStarsField, { path: 'rating', max: 2 }),
      { data: { rating: 1 } }
    )
    const button = wrapper.find('.stars')
    expect(button.text()).toBe('*')
    await button.trigger('click')
    await button.trigger('click')
    expect(data.rating).toBe(2)
    expect(await submit()).toEqual({ id: 1, rating: 2 })
  })
})
