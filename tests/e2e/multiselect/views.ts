import type { Tag } from './models/Tag.js'
import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

async function delay<T>(value: T): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, 200))
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
    // which also matches inside of them.
    shape: {
      type: 'multiselect',
      label: 'Shape',
      searchable: true,
      options: ['Circle', 'Square', 'Triangle'],
      search: ({
        searchTerm,
        options
      }: {
        searchTerm: string
        options: string[]
      }) => filterByBeginning(options, searchTerm)
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
