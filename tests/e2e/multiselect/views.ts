import type { Tag } from './models/Tag.js'
import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

async function delay<T>(value: T, milliseconds = 200): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
  return value
}

function filterByBeginning(options: string[], searchTerm: string) {
  return options.filter(option =>
    option.toLowerCase().startsWith(searchTerm.toLowerCase())
  )
}

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    size: {
      type: 'multiselect',
      label: 'Size',
      required: true,
      options: ['Small', 'Large']
    },
    // Filters the options by their beginning, unlike the internal search,
    // which also matches inside of them. The options are objects, which are
    // looked up by their values.
    shape: {
      type: 'multiselect',
      label: 'Shape',
      searchable: true,
      options: {
        data: ['Circle', 'Square', 'Triangle'].map(name => ({
          label: name,
          value: name.toLowerCase()
        })),
        label: 'label',
        value: 'value'
      },
      search: ({
        searchTerm,
        options
      }: {
        searchTerm: string
        options: { label: string, value: string }[]
      }) => {
        const labels = filterByBeginning(
          options.map(({ label }) => label),
          searchTerm
        )
        return options.filter(({ label }) => labels.includes(label))
      }
    },
    // Like searches that request their options: The options load
    // asynchronously, and so does the search.
    color: {
      type: 'multiselect',
      label: 'Color',
      searchable: true,
      options: { data: () => delay(['Red', 'Green', 'Blue']) },
      search: ({
        searchTerm,
        options
      }: {
        searchTerm: string
        options: string[]
      }) => delay(filterByBeginning(options, searchTerm))
    },
    // Searches for single letters take longer than the ones for longer terms,
    // so the results of older searches arrive after the ones of newer ones.
    paint: {
      type: 'multiselect',
      label: 'Paint',
      searchable: true,
      options: ['Blue', 'Black', 'Brown'],
      search: ({
        searchTerm,
        options
      }: {
        searchTerm: string
        options: string[]
      }) =>
        delay(
          filterByBeginning(options, searchTerm),
          searchTerm.length === 1 ? 600 : 50
        )
    },
    tags: {
      type: 'multiselect',
      label: 'Tags',
      multiple: true,
      relate: true,
      clearable: true,
      options: {
        data: ({ request }: { request: (opts: { url: string }) => Promise<Tag[]> }) =>
          request({ url: 'tags' }),
        label: 'name',
        value: 'id'
      }
    }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
