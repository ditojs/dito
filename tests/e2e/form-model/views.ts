import type { Article } from './models/Article.js'
import { createWidgetView } from '../../utils/views.js'
import { getValueAtDataPath, parseDataPath } from '@ditojs/utils'

// `permalink` is only displayed, not stored. Unnested sections don't hold data
// of their own, so their keys are `never`.
type ArticleItem = Article & {
  permalink?: string | null
  pricing?: string | null
  tagsText?: string | null
  seo: never
  resetChooser: never
  applySavedTitle: never
  replaceData: never
  previewKey?: string | null
  views?: string | null
  preview: never
  previewText?: string | null
  resetPreview: never
  // `notes` and the count of their changes are only edited, not stored.
  notes?: string | null
  notesChanges?: number | null
  // `doubleAmount` is only displayed, not stored.
  lines?: { amount?: number | null; doubleAmount?: number | null }[] | null
}

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
              compute: ({ value, options }) => (
                value ?? options?.[0]?.value ?? undefined
              )
            },
            category: {
              type: 'select',
              label: 'Category',
              options: { data: () => loadDelayed(categoryOptions) },
              compute: getValidOrFirstOption
            },
            // Like lineto's font chooser: The options come from data next to
            // the select, which a button resets.
            chooser: {
              type: 'section',
              label: 'Chooser',
              nested: true,
              components: {
                topic: {
                  type: 'select',
                  label: 'Chosen Topic',
                  options: { dataPath: '../source/topics' }
                }
              }
            },
            resetChooser: {
              type: 'button',
              text: 'Reset Chooser',
              events: {
                click: ({ item }) => {
                  item.chooser = {}
                }
              }
            },
            // Like lineto's actions that the server saves, e.g. creating the
            // template order of a FontPool plan: Applies the result as clean
            // changes.
            applySavedTitle: {
              type: 'button',
              text: 'Apply Saved Title',
              events: {
                click: ({ item, formComponent }) => {
                  formComponent.applyCleanChanges(() => {
                    item.title = 'Saved'
                  })
                }
              }
            },
            // Like lineto's actions that return the updated item: Replaces the
            // form's data, and modifies the returned reactive data.
            replaceData: {
              type: 'button',
              text: 'Replace Data',
              events: {
                click: ({ item, formComponent }) => {
                  const article = formComponent.setData({
                    ...item,
                    title: 'Replaced'
                  })
                  article.title = `${article.title} and Modified`
                }
              }
            },
            // Like lineto's license pricing: The computed value is derived from
            // other data when it's missing, and erases data that doesn't apply
            // to it. Its default only applies if the compute returns nothing.
            pricing: {
              type: 'select',
              label: 'Pricing',
              default: 'auto',
              exclude: true,
              options: [
                { label: 'Automatic', value: 'auto' },
                { label: 'Custom Factor', value: 'factor' }
              ],
              compute: ({ value, item }) => {
                const pricing = (
                  value ??
                  (item.customFactor != null ? 'factor' : undefined)
                )
                if (pricing !== 'factor') {
                  item.customFactor = null
                }
                return pricing
              }
            },
            customFactor: {
              type: 'number',
              label: 'Custom Factor',
              visible: ({ item }) => item.pricing === 'factor'
            },
            // Like lineto's target entries: The excluded value is stored under
            // another key through `process()`.
            tagsText: {
              type: 'text',
              label: 'Tags',
              exclude: true,
              compute: ({ value, item }) => value ?? item.tags?.join(',') ?? '',
              process: ({ value, processedItem }) => {
                processedItem.tags = value ? value.split(',') : null
              }
            },
            // Like lineto's custom font cut names: The compute relies on the
            // default of new items, and always shows one keyword to fill in.
            keywords: {
              type: 'list',
              label: 'Keywords',
              inlined: true,
              creatable: true,
              wrapPrimitives: 'keyword',
              compute: ({ value }: { value: (string | null)[] }) =>
                value.length > 0 ? value : [''],
              form: {
                type: 'form',
                components: {
                  keyword: { type: 'text', label: 'Keyword' }
                }
              }
            },
            // Like lineto's font preview: The section is hidden when its key is
            // reset, and its computed value loads from that key.
            previewKey: {
              type: 'text',
              label: 'Preview Key',
              exclude: true
            },
            preview: {
              type: 'section',
              if: ({ item }) => !!item.previewKey,
              components: {
                previewText: {
                  type: 'computed',
                  exclude: true,
                  data: ({ item }) => {
                    // Like lineto, rely on the section's `if` for the key.
                    const previewKey = item.previewKey as string
                    return async () => previewKey.toUpperCase()
                  }
                }
              }
            },
            resetPreview: {
              type: 'button',
              text: 'Reset Preview',
              events: {
                click: ({ item }) => {
                  item.previewKey = null
                }
              }
            },
            // Counts the changes of the markup, which are emitted once the
            // editing is done, like for lineto's article previews.
            notes: {
              type: 'markup',
              label: 'Notes',
              exclude: true,
              events: {
                change: ({ item }) => {
                  item.notesChanges = (item.notesChanges ?? 0) + 1
                }
              }
            },
            notesChanges: {
              type: 'number',
              label: 'Notes Changes',
              exclude: true,
              readonly: true
            },
            // A list without a form and without a resource, which only
            // displays its items, and saves them as they are.
            references: {
              type: 'list',
              label: 'References',
              columns: { title: { label: 'Title' } }
            },
            // Like lineto's royalty amounts: The computed value reads its line
            // from the root data through its data path.
            lines: {
              type: 'list',
              label: 'Lines',
              inlined: true,
              creatable: true,
              deletable: true,
              form: {
                type: 'form',
                components: {
                  amount: { type: 'number', label: 'Amount' },
                  doubleAmount: {
                    type: 'number',
                    label: 'Double Amount',
                    disabled: true,
                    exclude: true,
                    compute: ({ rootItem, dataPath }) => {
                      const line = getValueAtDataPath(
                        rootItem,
                        parseDataPath(dataPath).slice(0, 2)
                      )
                      return line.amount != null ? line.amount * 2 : null
                    }
                  }
                }
              }
            }
          }
        },
        // Only shown for articles that aren't drafts.
        stats: {
          type: 'tab',
          label: 'Stats',
          if: ({ item }) => item.title !== 'Draft',
          components: {
            views: { type: 'text', label: 'Views', exclude: true }
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
                  compute: ({ item }) => (
                    item.title?.toLowerCase().replaceAll(' ', '-') ?? null
                  )
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
