import { vi } from 'vitest'
import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { html } from '@ditojs/utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import CustomFieldPage from '../test/CustomFieldPage.vue'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoTextareaField,
  DitoCodeField,
  DitoMarkupField,
  DitoSliderField,
  DitoProgressField,
  DitoCheckboxField,
  DitoSelectField,
  DitoRadioField,
  DitoCheckboxesField,
  DitoMultiselectField,
  DitoDateField,
  DitoTimeField,
  DitoDateTimeField,
  DitoColorField,
  DitoUploadField,
  DitoCustomField,
  DitoListField
} from '../index.js'

const properties = {
  website: { type: 'string' },
  contact: { type: 'string', format: 'email' },
  notes: { type: 'string', maxLength: 200 },
  source: { type: 'string' },
  body: { type: 'string', nullable: true },
  rating: { type: 'number', range: [0, 5] },
  done: { type: 'number' },
  isPublic: { type: 'boolean' },
  format: { type: 'string', enum: ['hardcover', 'paperback'] },
  genre: { type: 'string', enum: ['jazz', 'rock'] },
  genres: { type: 'array', items: { type: 'string', enum: ['jazz', 'rock'] } },
  keywords: { type: 'array', items: { type: 'string' } },
  author: { type: 'object', relate: true },
  day: { type: 'date' },
  opensAt: { type: 'datetime' },
  opensDaily: { type: 'string', format: 'iso-time' },
  meetsAt: { type: 'datetime' },
  tint: { type: 'string' },
  shade: { type: 'object' },
  image: { type: 'asset', nullable: true },
  images: { type: 'array', items: { type: 'asset' } }
}

const authors = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Grace' }
]

const item = {
  id: 1,
  website: 'https://example.com',
  contact: 'ada@example.com',
  notes: 'Signed',
  source: 'let a = 1',
  body: '<p>Hello</p>',
  rating: 4,
  done: 50,
  isPublic: true,
  format: 'paperback',
  genre: 'jazz',
  genres: ['rock'],
  keywords: ['first'],
  author: { id: 1 },
  day: '2026-05-14',
  opensAt: '2026-05-14T07:30:00.000Z',
  opensDaily: '07:30:00',
  meetsAt: '2026-05-20T12:15:00.000Z',
  tint: '#3366ff',
  shade: { r: 0, g: 0, b: 255, a: 1 },
  image: null,
  images: []
}

// The form of the page, and the changes of its select:
let form = null
const onFormatChange = vi.fn()

// A page that edits each kind of value with its widget:
const BookPage = {
  setup() {
    form = useDitoForm({ resource: 'books', id: 1, properties })
    return () =>
      h(DitoSchemaForm, null, {
        default: () => [
          h(DitoTextField, { name: 'website', type: 'url' }),
          h(DitoTextField, { name: 'contact' }),
          h(DitoTextareaField, { name: 'notes', lines: 3 }),
          h(DitoCodeField, { name: 'source', language: 'javascript' }),
          h(DitoMarkupField, { name: 'body' }),
          h(DitoSliderField, { name: 'rating', step: 1 }),
          h(DitoProgressField, { name: 'done' }),
          h(DitoCheckboxField, { name: 'isPublic', label: 'Public' }),
          h(DitoSelectField, { name: 'format', onChange: onFormatChange }),
          h(DitoRadioField, { name: 'genre', layout: 'horizontal' }),
          h(DitoCheckboxesField, { name: 'genres' }),
          h(DitoMultiselectField, { name: 'keywords', taggable: true }),
          h(DitoSelectField, {
            name: 'author',
            options: { data: authors, label: 'name' }
          }),
          h(DitoDateField, {
            name: 'day',
            formats: { date: { day: 'numeric', month: 'numeric' } }
          }),
          h(DitoTimeField, { name: 'opensAt' }),
          h(DitoTimeField, { name: 'opensDaily' }),
          h(DitoDateTimeField, { name: 'meetsAt' }),
          h(DitoColorField, { name: 'tint' }),
          h(DitoColorField, { name: 'shade', colorFormat: 'rgb' }),
          h(DitoUploadField, { name: 'image', accept: 'image/*' }),
          h(DitoUploadField, { name: 'images' })
        ]
      })
  }
}

async function mountPage(component, path, data, views = {}) {
  const request = vi.fn(({ method = 'get', url, data: sentData }) => {
    if (method === 'get' && url === `/${path}/1`) {
      return { data: { ...data } }
    } else if (method === 'patch') {
      return { data: { ...sentData } }
    } else {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const admin = await mountAdmin({
    views: {
      page: { type: 'page', label: 'Page', path: 'page', component },
      ...views
    },
    request
  })
  await admin.navigate('/page')
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve))
  await flushPromises()
  return { admin, request, wrapper: admin.wrapper }
}

const getContainer = (wrapper, label) =>
  wrapper
    .findAll('.dito-container')
    .find(container => {
      const containerLabel = container.find('.dito-label')
      return containerLabel.exists() && containerLabel.text() === label
    })

const getSentData = request =>
  request.mock.calls
    .map(([options]) => options)
    .filter(({ method }) => method === 'patch')
    .map(({ data }) => data)

describe('widgets of values', () => {
  afterEach(() => {
    form = null
    onFormatChange.mockClear()
  })

  it('render the type components of their properties', async () => {
    const { wrapper } = await mountPage(BookPage, 'books', item)
    const getComponentClasses = label =>
      getContainer(wrapper, label).find('.dito-component').classes()
    expect(getComponentClasses('Notes')).toContain('dito-textarea')
    expect(getComponentClasses('Source')).toContain('dito-code')
    expect(getComponentClasses('Body')).toContain('dito-markup')
    expect(getComponentClasses('Rating')).toContain('dito-slider')
    expect(getComponentClasses('Done')).toContain('dito-progress')
    expect(getComponentClasses('Public')).toContain('dito-checkbox')
    expect(getComponentClasses('Format')).toContain('dito-select')
    expect(getComponentClasses('Genre')).toContain('dito-radio-buttons')
    expect(getComponentClasses('Genres')).toContain('dito-checkboxes')
    expect(getComponentClasses('Keywords')).toContain('dito-multiselect')
    expect(getComponentClasses('Day')).toContain('dito-date')
    // The widgets pick the pickers, also of the same type of value:
    const getPicker = label =>
      getContainer(wrapper, label).find('.dito-date > *').classes()
    expect(getPicker('Day')).toContain('dito-date-picker')
    expect(getPicker('Opens At')).toContain('dito-time-picker')
    expect(getPicker('Meets At')).toContain('dito-date-time-picker')
    // The `formats` of date widgets merge over `api.formats`:
    expect(getContainer(wrapper, 'Day').find('input').element.value).toBe(
      '5/14/2026'
    )
    expect(getComponentClasses('Tint')).toContain('dito-color')
    expect(getComponentClasses('Image')).toContain('dito-upload')
    expect(getContainer(wrapper, 'Notes').find('textarea').element.value).toBe(
      'Signed'
    )
    expect(
      getContainer(wrapper, 'Notes').find('textarea').attributes('maxlength')
    ).toBe('200')
    expect(
      getContainer(wrapper, 'Rating').find('input').attributes('max')
    ).toBe('5')
  })

  it('pick the input type with `type`, not the `format` of the property', async () => {
    const { wrapper } = await mountPage(BookPage, 'books', item)
    const getInputType = label =>
      getContainer(wrapper, label).find('input').attributes('type')
    expect(getInputType('Website')).toBe('url')
    expect(getInputType('Contact')).toBe('text')
  })

  it('take callbacks for the options of fields that take them', async () => {
    const warn = vi.spyOn(console, 'warn')
    const SliderPage = {
      setup() {
        form = useDitoForm({ resource: 'books', id: 1, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () =>
              h(DitoSliderField, {
                name: 'rating',
                step: ({ item }) => (item.isPublic ? 0.5 : 1)
              })
          })
      }
    }
    const { wrapper } = await mountPage(SliderPage, 'books', item)
    expect(
      getContainer(wrapper, 'Rating').find('input').attributes('step')
    ).toBe('0.5')
    const warnings = warn.mock.calls.flat().join()
    warn.mockRestore()
    expect(warnings).not.toContain('Invalid prop')
  })

  it('render `html` in labels, info and affixes, as fields do', async () => {
    const warn = vi.spyOn(console, 'warn')
    const WebsitePage = {
      setup() {
        form = useDitoForm({ resource: 'books', id: 1, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () =>
              h(DitoTextField, {
                name: 'website',
                label: html`<b>Site</b>`,
                info: html`<i>Public</i>`,
                prefix: html`<em>https</em>`
              })
          })
      }
    }
    const { wrapper } = await mountPage(WebsitePage, 'books', item)
    const markup = wrapper.html()
    expect(markup).toContain('<b>Site</b>')
    expect(markup).toContain('<i>Public</i>')
    expect(markup).toContain('<em>https</em>')
    const warnings = warn.mock.calls.flat().join()
    warn.mockRestore()
    expect(warnings).not.toContain('Invalid prop')
  })

  it('store colors in the format of `colorFormat`', async () => {
    const { wrapper } = await mountPage(BookPage, 'books', item)
    const input = getContainer(wrapper, 'Shade').find('input')
    expect(input.element.value).toBe('0000ff')
    await enterValue(input, 'ff0000')
    expect(form.item.shade).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  it('offer the `enum` of their properties as options', async () => {
    const { wrapper } = await mountPage(BookPage, 'books', item)
    const select = getContainer(wrapper, 'Format').find('select')
    expect(select.findAll('option').map(option => option.text())).toEqual([
      'Hardcover',
      'Paperback'
    ])
    expect(select.element.value).toBe('paperback')
    const checkboxes = getContainer(wrapper, 'Genres').findAll('input')
    expect(checkboxes.map(input => input.element.checked)).toEqual([
      false,
      true
    ])
    await checkboxes[0].setValue(true)
    expect(form.item.genres).toEqual(['rock', 'jazz'])
  })

  it('select several options of arrays in multiselects', async () => {
    const GenresPage = {
      setup() {
        form = useDitoForm({ resource: 'books', id: 1, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () => h(DitoMultiselectField, { name: 'genres' })
          })
      }
    }
    const { wrapper } = await mountPage(GenresPage, 'books', item)
    const tags = getContainer(wrapper, 'Genres').findAll('.multiselect__tag')
    expect(tags.map(tag => tag.text())).toEqual(['Rock'])
  })

  it.each([
    ['DitoSelectField', DitoSelectField, 'select'],
    ['DitoRadioField', DitoRadioField, 'radio']
  ])('throw for array properties in %s', async (_, widget, type) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const GenresPage = {
      setup() {
        useDitoForm({ resource: 'books', id: 1, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () => h(widget, { name: 'genres' })
          })
      }
    }
    await mountPage(GenresPage, 'books', item)
    expect([...error.mock.calls, ...warn.mock.calls].flat()).toContainEqual(
      expect.objectContaining({
        message: (
          `Unsupported array property in '${type}' widgets, use ` +
          '`DitoCheckboxesField` or `DitoMultiselectField`.'
        )
      })
    )
  })

  it('edit related values with loaded options, and emit changes', async () => {
    const { wrapper, request } = await mountPage(BookPage, 'books', item)
    const author = getContainer(wrapper, 'Author').find('select')
    expect(author.findAll('option').map(option => option.text())).toEqual([
      'Ada',
      'Grace'
    ])
    await author.setValue(author.findAll('option')[1].element.value)
    await getContainer(wrapper, 'Format').find('select').setValue('hardcover')
    await flushPromises()
    expect(onFormatChange).toHaveBeenCalledOnce()
    expect(onFormatChange.mock.calls[0][0].value).toBe('hardcover')
    expect(await form.submit()).toBe(true)
    expect(getSentData(request)).toEqual([
      expect.objectContaining({
        format: 'hardcover',
        author: { id: 2 },
        day: '2026-05-14'
      })
    ])
  })

  it('validate the `enum` of their properties', async () => {
    await mountPage(BookPage, 'books', item)
    form.item.genre = 'pop'
    expect(form.validate()).toBe(false)
    expect(form.getErrors()).toEqual({
      genre: [{ message: 'must be one of the options' }]
    })
  })

  it('edit options in their view with `editable`', async () => {
    const genres = {
      type: 'view',
      field: {
        type: 'list',
        resource: { path: 'genres' },
        form: { type: 'form', fields: { name: { type: 'text' } } }
      }
    }
    const GenrePage = {
      setup() {
        useDitoForm({
          resource: 'books',
          id: 1,
          properties: {
            genre: { type: 'string' },
            genres: { type: 'array', items: { type: 'string' } }
          }
        })
        const props = {
          options: ['jazz', 'rock'],
          editable: true,
          view: 'genres'
        }
        return () =>
          h(DitoSchemaForm, null, {
            default: () => [
              h(DitoSelectField, { name: 'genre', label: 'Select', ...props }),
              h(DitoRadioField, { name: 'genre', label: 'Radio', ...props }),
              h(DitoMultiselectField, {
                name: 'genre',
                label: 'Multiselect',
                ...props
              }),
              h(DitoCheckboxesField, {
                name: 'genres',
                label: 'Checkboxes',
                ...props
              })
            ]
          })
      }
    }
    const { wrapper } = await mountPage(
      GenrePage,
      'books',
      { id: 1, genre: 'jazz', genres: [] },
      { genres }
    )
    const getEditPaths = label =>
      getContainer(wrapper, label)
        .findAll('.dito-options-edit-buttons a')
        .map(link => link.attributes('href'))
    expect(getEditPaths('Select')).toEqual(['/genres/jazz'])
    expect(getEditPaths('Multiselect')).toEqual(['/genres/jazz'])
    // Radio buttons and checkboxes edit each of their options:
    expect(getEditPaths('Radio')).toEqual(['/genres/jazz', '/genres/rock'])
    expect(getEditPaths('Checkboxes')).toEqual(['/genres/jazz', '/genres/rock'])
  })
})

describe('DitoCustomField', () => {
  const mountCustomFieldPage = () =>
    mountPage(CustomFieldPage, 'codes', { id: 1, code: 'ABC' })

  it('passes the field to its slot, which edits it with `v-model`', async () => {
    const { wrapper } = await mountCustomFieldPage()
    const { form } = wrapper.findComponent(CustomFieldPage).vm
    const container = getContainer(wrapper, 'Code')
    const input = container.find('input.custom-code')
    expect(input.element.value).toBe('ABC')
    expect(container.find('.custom-limit').text()).toBe('8')
    await enterValue(input, 'XYZ')
    expect(form.item.code).toBe('XYZ')
  })

  it('renders its slot in an element with the attributes of the field', async () => {
    const { wrapper } = await mountCustomFieldPage()
    const container = getContainer(wrapper, 'Code')
    const component = container.find('.dito-component--fill')
    expect(component.find('input.custom-code').exists()).toBe(true)
    // The label points to the element of the field:
    expect(component.attributes('id')).toBe(
      container.find('label').attributes('for')
    )
    await enterValue(component.find('input'), 'TOO-LONG-CODE')
    await component.find('input').trigger('blur')
    expect(component.attributes('aria-invalid')).toBe('true')
    expect(component.attributes('aria-describedby')).toBe(
      container.find('.dito-errors').attributes('id')
    )
  })

  it('reads back the values that its slot writes right away', async () => {
    const { wrapper } = await mountCustomFieldPage()
    const { form } = wrapper.findComponent(CustomFieldPage).vm
    const input = wrapper.find('input.custom-code')
    await enterValue(input, ' xyz ')
    await wrapper.find('button.custom-normalize').trigger('click')
    expect(form.item.code).toBe('XYZ')
    expect(input.element.value).toBe('XYZ')
  })

  it('validates the field when its slot asks', async () => {
    const { wrapper } = await mountCustomFieldPage()
    const input = wrapper.find('input.custom-code')
    await enterValue(input, 'TOO-LONG-CODE')
    await input.trigger('blur')
    expect(wrapper.find('.custom-errors').text()).toBe(
      'must be at most 8 characters long'
    )
    expect(getContainer(wrapper, 'Code').find('.dito-errors').text()).toBe(
      'The Code field must be at most 8 characters long.'
    )
  })

  it('shows the errors of the field', async () => {
    const { wrapper } = await mountCustomFieldPage()
    const { form } = wrapper.findComponent(CustomFieldPage).vm
    await enterValue(wrapper.find('input.custom-code'), '')
    expect(form.validate()).toBe(false)
    await flushPromises()
    expect(wrapper.find('.custom-errors').text()).toBe('is required')
    expect(getContainer(wrapper, 'Code').find('.dito-errors').text()).toBe(
      'The Code field is required.'
    )
  })

  // A page that displays content without a value beside a list of values,
  // whose items the custom field edits without `name`:
  let notesForm = null
  const NotesPage = {
    setup() {
      notesForm = useDitoForm({
        resource: 'codes',
        id: 1,
        properties: {
          code: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        }
      })
      return () =>
        h(DitoSchemaForm, null, {
          default: () => [
            h(
              DitoCustomField,
              { label: 'Note', width: '1/2', info: 'About codes' },
              {
                default: () =>
                  h('p', { class: 'custom-note' }, notesForm.item.code)
              }
            ),
            h(
              DitoCustomField,
              { width: '1/2' },
              { default: () => h('p', { class: 'custom-hint' }, 'Hint') }
            ),
            h(
              DitoListField,
              { name: 'tags' },
              {
                default: () =>
                  h(DitoCustomField, null, {
                    default: field =>
                      h('input', {
                        class: 'custom-tag',
                        value: field.value,
                        onInput: event => (field.value = event.target.value)
                      })
                  })
              }
            )
          ]
        })
    }
  }

  it('displays its content without `name`, in a field container', async () => {
    const { wrapper } = await mountPage(NotesPage, 'codes', {
      id: 1,
      code: 'ABC',
      tags: []
    })
    const container = getContainer(wrapper, 'Note')
    expect(container.find('.custom-note').text()).toBe('ABC')
    expect(container.find('.custom-note').attributes('id')).toBeUndefined()
    // It fills the container like the components of other fields:
    expect(container.find('.dito-component--fill .custom-note').exists()).toBe(
      true
    )
    expect(container.attributes('style')).toContain('--basis: 50%')
    expect(container.find('.dito-info').exists()).toBe(true)
    // Content without `label` shows none:
    const hint = wrapper.find('.custom-hint')
    expect(hint.element.closest('.dito-container').querySelector('.dito-label'))
      .toBeNull()
    // It holds no value of its own:
    expect(notesForm.item).toEqual({ id: 1, code: 'ABC', tags: [] })
    expect(notesForm.validate()).toBe(true)
  })

  it('edits the items of lists of values without `name`', async () => {
    const { wrapper } = await mountPage(NotesPage, 'codes', {
      id: 1,
      code: 'ABC',
      tags: ['first']
    })
    const input = wrapper.find('input.custom-tag')
    expect(input.element.value).toBe('first')
    await enterValue(input, 'second')
    expect(notesForm.item.tags).toEqual(['second'])
  })

  describe('edits', () => {
    // A page whose custom field edits the code with one input beside another,
    // and with a button:
    const onCodeChange = vi.fn()
    const EditPage = {
      setup() {
        useDitoForm({
          resource: 'codes',
          id: 1,
          properties: { code: { type: 'string', maxLength: 8 } }
        })
        return () =>
          h(DitoSchemaForm, null, {
            default: () =>
              h(
                DitoCustomField,
                { name: 'code', label: 'Code', onChange: onCodeChange },
                {
                  default: field => [
                    h('input', {
                      class: 'custom-code',
                      value: field.value,
                      onInput: event => (field.value = event.target.value)
                    }),
                    h('input', { class: 'custom-other' }),
                    h('button', {
                      class: 'custom-clear',
                      type: 'button',
                      onClick: () => (field.value = '')
                    })
                  ]
                }
              )
          })
      }
    }

    const mountEditPage = () =>
      mountPage(EditPage, 'codes', { id: 1, code: 'ABC' })

    const typeValue = async (input, value) => {
      for (let i = 1; i <= value.length; i++) {
        input.element.value = value.slice(0, i)
        await input.trigger('input')
      }
    }

    afterEach(() => onCodeChange.mockClear())

    it('emits `change` once the focus leaves it', async () => {
      const { wrapper } = await mountEditPage()
      const input = wrapper.find('input.custom-code')
      input.element.focus()
      await typeValue(input, 'XYZ')
      expect(onCodeChange).not.toHaveBeenCalled()
      // Moving the focus inside the field doesn't end the edit:
      wrapper.find('input.custom-other').element.focus()
      await flushPromises()
      expect(onCodeChange).not.toHaveBeenCalled()
      document.activeElement.blur()
      await flushPromises()
      expect(onCodeChange).toHaveBeenCalledOnce()
      expect(onCodeChange.mock.calls[0][0].value).toBe('XYZ')
    })

    it(`doesn't emit \`change\` when the value is the same`, async () => {
      const { wrapper } = await mountEditPage()
      const input = wrapper.find('input.custom-code')
      input.element.focus()
      await typeValue(input, 'ABCD')
      input.element.value = 'ABC'
      await input.trigger('input')
      input.element.blur()
      await flushPromises()
      expect(onCodeChange).not.toHaveBeenCalled()
    })

    it('emits `change` right away for writes without focus', async () => {
      const { wrapper } = await mountEditPage()
      await wrapper.find('button.custom-clear').trigger('click')
      expect(onCodeChange).toHaveBeenCalledOnce()
      expect(onCodeChange.mock.calls[0][0].value).toBe('')
    })

    it('validates its value when the focus leaves it after edits', async () => {
      const { wrapper } = await mountEditPage()
      const container = getContainer(wrapper, 'Code')
      const input = wrapper.find('input.custom-code')
      input.element.focus()
      await typeValue(input, 'TOO-LONG-CODE')
      wrapper.find('input.custom-other').element.focus()
      await flushPromises()
      expect(container.find('.dito-errors').exists()).toBe(false)
      document.activeElement.blur()
      await flushPromises()
      expect(container.find('.dito-errors').text()).toBe(
        'The Code field must be at most 8 characters long.'
      )
    })
  })
})
