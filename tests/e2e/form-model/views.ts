import type { Article } from './models/Article.js'
import { createWidgetView } from '../../utils/views.js'

// `permalink` is only displayed, not stored. Unnested sections don't hold data
// of their own, so their keys are `never`.
type ArticleItem = Article & { permalink?: string | null; seo: never }

type Option = { label: string; value: string }

const categoryOptions: Option[] = [
  { label: 'News', value: 'news' },
  { label: 'Sports', value: 'sports' }
]

const topicOptionsByCategory: Record<string, Option[]> = {
  news: [
    { label: 'Politics', value: 'politics' },
    { label: 'Economy', value: 'economy' }
  ],
  sports: [
    { label: 'Football', value: 'football' },
    { label: 'Tennis', value: 'tennis' }
  ]
}

// Delays loading options, so that saving right after opening an article has
// to wait for them.
async function loadDelayed<T>(value: T): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, 500))
  return value
}

// Like lineto's `getValidOrDefaultOption()`: Keeps valid values, and selects
// the first option otherwise, once the options are loaded.
function getValidOrFirstOption({
  value,
  options
}: {
  value: string | null | undefined
  options?: Option[]
}) {
  return options
    ? value && options.some(option => option.value === value)
      ? value
      : (options[0]?.value ?? null)
    : value
}

export const articles = createWidgetView<ArticleItem>(
  'Article',
  'articles',
  {},
  {
    columns: { title: { label: 'Title' } },
    form: {
      type: 'form',
      tabs: {
        main: {
          type: 'tab',
          label: 'Main',
          defaultTab: true,
          components: {
            title: { type: 'text', label: 'Title' },
            // Displays the computed `slug` of the Meta tab, which isn't
            // rendered, as its section is collapsed.
            permalink: {
              type: 'text',
              label: 'Permalink',
              disabled: true,
              exclude: true,
              compute: ({ item }) =>
                item.slug ? `/articles/${item.slug}` : null
            },
            // Selects the first option once the options are loaded, like
            // lineto's `getValidOrDefaultOption()`.
            status: {
              type: 'select',
              label: 'Status',
              options: {
                data: async () => [
                  { label: 'Draft', value: 'draft' },
                  { label: 'Published', value: 'published' }
                ]
              },
              compute: ({ value, options }) =>
                value ?? options?.[0]?.value ?? undefined
            },
            category: {
              type: 'select',
              label: 'Category',
              options: { data: () => loadDelayed(categoryOptions) },
              compute: getValidOrFirstOption
            }
          }
        },
        meta: {
          type: 'tab',
          label: 'Meta',
          components: {
            seo: {
              type: 'section',
              label: 'SEO',
              collapsible: true,
              collapsed: true,
              components: {
                slug: {
                  type: 'computed',
                  compute: ({ item }) =>
                    item.title?.toLowerCase().replaceAll(' ', '-') ?? null
                },
                // Resolved asynchronously from a data schema.
                titleLength: {
                  type: 'computed',
                  data: ({ item }) => {
                    const { title } = item
                    return async () => title?.length ?? null
                  }
                },
                // Depends on the computed `category` through its options,
                // loaded with the curried pattern: The outer function tracks
                // `category`, the returned one loads the options.
                topic: {
                  type: 'select',
                  label: 'Topic',
                  options: {
                    data: ({ item }) => {
                      const { category } = item
                      return () =>
                        loadDelayed(
                          category ? topicOptionsByCategory[category] : []
                        )
                    }
                  },
                  compute: getValidOrFirstOption
                }
              }
            }
          }
        }
      }
    }
  }
)
