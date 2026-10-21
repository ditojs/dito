import { vi } from 'vitest'
import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import CustomFieldPage from '../test/CustomFieldPage.vue'
import {
  useDitoForm,
  DitoSchemaForm,
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
  DitoColorField,
  DitoUploadField
} from '../index.js'

const properties = {
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
  tint: { type: 'string' },
  image: { type: 'asset', nullable: true },
  images: { type: 'array', items: { type: 'asset' } }
}

const authors = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Grace' }
]

const item = {
  id: 1,
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
  tint: '#3366ff',
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
          h(DitoDateField, { name: 'day' }),
          h(DitoColorField, { name: 'tint' }),
          h(DitoUploadField, { name: 'image', accept: 'image/*' }),
          h(DitoUploadField, { name: 'images' })
        ]
      })
  }
}

async function mountPage(component, path, data) {
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
      page: { type: 'page', label: 'Page', path: 'page', component }
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
})
