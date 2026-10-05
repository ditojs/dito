import type { Article } from './models/Article.js'
import { createWidgetView } from '../../utils/views.js'

// `permalink` is only displayed, not stored. Unnested sections don't hold data
// of their own, so their keys are `never`.
type ArticleItem = Article & { permalink?: string | null; seo: never }

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
                }
              }
            }
          }
        }
      }
    }
  }
)
