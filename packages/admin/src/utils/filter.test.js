import { vi } from 'vitest'
import { ref } from 'vue'
import {
  createFiltersPanel,
  filterComponents,
  getFiltersDataErrors
} from './filter.js'

// The filters of a list of books, covering the built-in filter types as well
// as custom filters with their own components:
function createBookFilters() {
  return {
    sticky: true,
    title: {
      filter: 'text',
      operators: ['contains', 'starts-with']
    },
    author: {
      filter: 'text'
    },
    published: {
      label: 'Published Between',
      filter: 'date-range',
      width: '1/2'
    },
    genres: {
      width: '1/2',
      components: {
        genres: {
          type: 'multiselect',
          options: ['fiction', 'poetry', 'essay']
        }
      }
    },
    available: {
      components: {
        available: {
          type: 'checkbox',
          label: 'Only Available'
        }
      }
    }
  }
}

function createPanel({
  filters = createBookFilters(),
  query = {},
  defaults = {}
} = {}) {
  const queryRef = ref(query)
  const panel = createFiltersPanel({ defaults }, filters, 'books', queryRef)
  return { panel, query: queryRef }
}

// Mimics the panel's schema component, with the computed properties and
// methods of the panel schema bound to it.
function createPanelComponent(panel, data) {
  const component = {
    schema: panel,
    data,
    resetData: vi.fn(() => {
      for (const key in component.data) {
        component.data[key] = {}
      }
    })
  }
  for (const [key, getter] of Object.entries(panel.computed)) {
    Object.defineProperty(component, key, { get: getter.bind(component) })
  }
  for (const [key, method] of Object.entries(panel.methods)) {
    component[key] = method.bind(component)
  }
  return component
}

describe('filterComponents', () => {
  describe(`'text'`, () => {
    it('only creates a text component without `operators`', () => {
      const components = filterComponents.text({})
      expect(components.operator).toBe(null)
      expect(components.text).toMatchObject({ type: 'text', width: 'fill' })
    })

    it('offers all operators with `operators: true`', () => {
      const { operator, text } = filterComponents.text({ operators: true })
      expect(operator.options.map(option => option.value)).toEqual([
        'contains',
        'equals',
        'starts-with',
        'ends-with'
      ])
      expect(operator.width).toBe('2/5')
      expect(text.width).toBe('3/5')
    })

    it('limits the operators to the ones listed in `operators`', () => {
      const { operator } = filterComponents.text({
        operators: ['ends-with', 'equals']
      })
      // Keeps the order of the built-in operators:
      expect(operator.options.map(option => option.value)).toEqual([
        'equals',
        'ends-with'
      ])
    })
  })

  describe(`'date-range'`, () => {
    it('creates clearable `from` and `to` datetime components', () => {
      const { from, to } = filterComponents['date-range']()
      expect(from).toMatchObject({
        type: 'datetime',
        width: '1/2',
        clearable: true
      })
      expect(to).toEqual(from)
    })
  })
})

describe('createFiltersPanel()', () => {
  it('creates a sticky panel with an inlined object component per filter', () => {
    const { panel } = createPanel()
    expect(panel).toMatchObject({
      type: 'panel',
      name: '$filters',
      label: 'Filters',
      sticky: true,
      disabled: false
    })
    // Filter data keys are prefixed with `$` to not clash with other data:
    expect(Object.keys(panel.components)).toEqual([
      '$title',
      '$author',
      '$published',
      '$genres',
      '$available'
    ])
    expect(panel.components.$genres).toMatchObject({
      type: 'object',
      label: 'Genres',
      width: '1/2',
      inlined: true
    })
    expect(panel.components.$genres.default()).toEqual({})
  })

  it('keeps explicit filter labels and derives the others from the name', () => {
    const { panel } = createPanel()
    expect(panel.components.$published.label).toBe('Published Between')
    expect(panel.components.$author.label).toBe('Author')
  })

  it('converts the labels of filter components to placeholders', () => {
    const { panel } = createPanel()
    const { components } = panel.components.$title.form
    expect(components.operator).toMatchObject({
      label: false,
      placeholder: 'Operator'
    })
    expect(components.text).toMatchObject({
      label: false,
      placeholder: 'Text'
    })
    // Custom components keep their own labels as placeholders:
    expect(panel.components.$available.form.components.available).toMatchObject(
      { label: false, placeholder: 'Only Available' }
    )
  })

  it('leaves out the operator component of text filters without operators', () => {
    const { panel } = createPanel()
    expect(Object.keys(panel.components.$author.form.components)).toEqual([
      'text'
    ])
  })

  it('applies the API defaults of the types to the filter components', () => {
    const { panel } = createPanel({
      defaults: { text: { trim: true } }
    })
    expect(panel.components.$author.form.components.text.trim).toBe(true)
  })

  it('creates a panel without components for empty filters', () => {
    const { panel } = createPanel({ filters: { sticky: false } })
    expect(panel.components).toEqual({})
    expect(panel.data()).toEqual({})
  })

  it('throws for filters with an unknown filter type', () => {
    expect(() =>
      createPanel({ filters: { title: { filter: 'fuzzy' } } })
    ).toThrow(`Invalid filter 'title': Unknown filter type 'fuzzy'.`)
  })

  it('throws for filters with neither a filter type nor components', () => {
    expect(() => createPanel({ filters: { title: { label: 'Title' } } }))
      .toThrow(`Invalid filter 'title': Unknown filter type 'undefined'.`)
  })

  describe('parsing the query into filter data', () => {
    it('creates empty data for each filter without a query', () => {
      const { panel } = createPanel({ query: {} })
      expect(panel.data()).toEqual({
        $title: {},
        $author: {},
        $published: {},
        $genres: {},
        $available: {}
      })
    })

    it('creates empty data for each filter while the query is `null`', () => {
      const { panel } = createPanel({ query: null })
      expect(panel.data()).toEqual({
        $title: {},
        $author: {},
        $published: {},
        $genres: {},
        $available: {}
      })
    })

    it('maps the arguments of each filter to its components in sequence', () => {
      const { panel } = createPanel({
        query: {
          filter: [
            'title:"starts-with","The"',
            'published:"2020-01-01T00:00:00.000Z",null',
            'genres:["poetry","essay"]',
            'available:false'
          ]
        }
      })
      expect(panel.data()).toEqual({
        $title: { operator: 'starts-with', text: 'The' },
        $author: {},
        $published: { from: '2020-01-01T00:00:00.000Z', to: null },
        $genres: { genres: ['poetry', 'essay'] },
        $available: { available: false }
      })
    })

    it('supports a single filter as a string', () => {
      const { panel } = createPanel({ query: { filter: 'author:"Le Guin"' } })
      expect(panel.data().$author).toEqual({ text: 'Le Guin' })
    })

    it('ignores filters with invalid JSON arguments', () => {
      const { panel } = createPanel({
        query: { filter: ['author:Le Guin', 'title:"contains","Sea"'] }
      })
      const data = panel.data()
      expect(data.$author).toEqual({})
      expect(data.$title).toEqual({ operator: 'contains', text: 'Sea' })
    })

    it('ignores filters in the query that the panel does not define', () => {
      const { panel } = createPanel({ query: { filter: 'isbn:"123"' } })
      expect(Object.keys(panel.data())).not.toContain('$isbn')
    })

    it('reads the current query each time', () => {
      const { panel, query } = createPanel()
      expect(panel.data().$author).toEqual({})
      query.value = { filter: 'author:"Austen"' }
      expect(panel.data().$author).toEqual({ text: 'Austen' })
    })

    it('ignores filter entries without a name, with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { panel } = createPanel({
        query: { filter: ['Austen', 'author:"Le Guin"'] }
      })
      expect(panel.data().$author).toEqual({ text: 'Le Guin' })
      expect(warn).toHaveBeenCalledWith(`Ignoring malformed filter: 'Austen'`)
      warn.mockRestore()
    })

    it('ignores filter entries without a value, with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // E.g. `?filter&filter=author:"Le Guin"`:
      const { panel } = createPanel({
        query: { filter: [null, 'author:"Le Guin"'] }
      })
      expect(panel.data().$author).toEqual({ text: 'Le Guin' })
      expect(warn).toHaveBeenCalledWith(`Ignoring malformed filter: 'null'`)
      warn.mockRestore()
    })
  })

  describe('formatting filter data into the query', () => {
    it('formats each filter as its name and JSON arguments', () => {
      const { panel } = createPanel()
      const component = createPanelComponent(panel, {
        $title: { operator: 'contains', text: 'Sea' },
        $author: {},
        $published: { from: new Date('2020-01-01T00:00:00Z'), to: null },
        $genres: { genres: ['poetry'] },
        $available: { available: false }
      })
      expect(component.filters).toEqual([
        'title:"contains","Sea"',
        'published:"2020-01-01T00:00:00.000Z",null',
        'genres:["poetry"]',
        // `false` is a value, unlike `null`, so the filter still applies:
        'available:false'
      ])
      expect(component.hasFilters).toBe(true)
    })

    it('fills missing arguments with `null` to keep their sequence', () => {
      const { panel } = createPanel()
      const component = createPanelComponent(panel, {
        $title: { text: 'Sea' }
      })
      expect(component.filters).toEqual(['title:null,"Sea"'])
    })

    it('leaves out filters with only `null` or missing arguments', () => {
      const { panel } = createPanel()
      const component = createPanelComponent(panel, {
        $title: { operator: null, text: null },
        $published: { from: null },
        $author: null
      })
      expect(component.filters).toEqual([])
      expect(component.hasFilters).toBe(false)
    })

    it('round-trips the filters through the query', () => {
      const { panel, query } = createPanel()
      const data = {
        $title: { operator: 'starts-with', text: 'A "quoted", title' },
        $author: { text: 'Woolf' },
        $published: {},
        $genres: { genres: ['fiction', 'essay'] },
        $available: { available: true }
      }
      const component = createPanelComponent(panel, data)
      component.applyFilters()
      expect(panel.data()).toEqual(data)
      expect(query.value.filter).toEqual(component.filters)
    })
  })

  describe('applying and clearing filters', () => {
    it('stores the filters in the query and resets the pagination', () => {
      const { panel, query } = createPanel({
        query: { page: 3, order: 'title' }
      })
      const component = createPanelComponent(panel, {
        $author: { text: 'Woolf' }
      })
      component.applyFilters()
      expect(query.value).toEqual({
        order: 'title',
        filter: ['author:"Woolf"'],
        page: undefined
      })
    })

    it('applies the filters when the panel data changes', () => {
      const { panel, query } = createPanel()
      const component = createPanelComponent(panel, {
        $author: { text: 'Woolf' }
      })
      panel.events.change.call(component)
      expect(query.value.filter).toEqual(['author:"Woolf"'])
    })

    it('resets the data and applies the empty filters when clearing', () => {
      const { panel, query } = createPanel({
        query: { filter: ['author:"Woolf"'], page: 2 }
      })
      const component = createPanelComponent(panel, {
        $author: { text: 'Woolf' }
      })
      component.clearFilters()
      expect(component.resetData).toHaveBeenCalledOnce()
      expect(query.value).toEqual({ filter: [], page: undefined })
    })
  })

  describe('buttons', () => {
    it('labels the form buttons but not the small panel buttons', () => {
      const { panel } = createPanel()
      expect(panel.buttons.clear.text).toBe('Clear')
      expect(panel.buttons.submit).toMatchObject({
        type: 'submit',
        text: 'Filter',
        visible: true
      })
      expect(panel.panelButtons.clear.text).toBe(null)
      expect(panel.panelButtons.submit.visible).toBe(false)
    })

    it('disables the clear button while there are no filters', () => {
      const { panel } = createPanel()
      const { disabled } = panel.buttons.clear
      expect(disabled({ schemaComponent: { hasFilters: false } })).toBe(true)
      expect(disabled({ schemaComponent: { hasFilters: true } })).toBe(false)
    })

    it('delegates clicks to the panel schema component', () => {
      const { panel } = createPanel()
      const schemaComponent = {
        clearFilters: vi.fn(),
        applyFilters: vi.fn()
      }
      panel.panelButtons.clear.events.click({ schemaComponent })
      panel.buttons.submit.events.click({ schemaComponent })
      expect(schemaComponent.clearFilters).toHaveBeenCalledOnce()
      expect(schemaComponent.applyFilters).toHaveBeenCalledOnce()
    })
  })
})

describe('getFiltersDataErrors()', () => {
  it('keys the errors of filters by their data names', () => {
    const titleErrors = [{ message: 'must be longer' }]
    const yearErrors = [{ message: 'must be a number' }]
    expect(
      getFiltersDataErrors({
        'title/text': titleErrors,
        'year.from': yearErrors
      })
    ).toEqual({
      '$title/text': titleErrors,
      '$year/from': yearErrors
    })
  })

  it('keeps paths that already start with a data name', () => {
    const errors = [{ message: 'must be shorter' }]
    expect(getFiltersDataErrors({ '$title.text': errors })).toEqual({
      '$title/text': errors
    })
  })

  it('merges the errors of paths that map to the same data path', () => {
    const first = { message: 'must be longer' }
    const second = { message: 'must be shorter' }
    expect(
      getFiltersDataErrors({
        'title/text': [first],
        '$title.text': [second]
      })
    ).toEqual({ '$title/text': [first, second] })
  })
})
