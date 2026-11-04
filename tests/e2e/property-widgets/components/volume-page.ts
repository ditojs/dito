import { defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoListField
} from '@ditojs/admin'
import type { Chapter, Volume } from '../models/Volume.js'

// A page that edits volumes, with prices and chapters of two kinds, laid out by
// their type:
export default defineComponent({
  setup() {
    const route = useRoute()
    useDitoForm<Volume>({
      resource: 'volumes',
      id: () => (route.params.id as string) || null,
      properties: {
        name: { type: 'string', required: true },
        prices: { type: 'array', items: { type: 'number', minimum: 0 } },
        chapters: {
          type: 'array',
          forms: {
            section: {
              label: 'Section',
              properties: { name: { type: 'string', required: true } }
            },
            bundle: {
              label: 'Bundle',
              properties: {
                title: { type: 'string', required: true },
                discount: { type: 'integer', default: 10 }
              }
            }
          }
        }
      }
    })
    return () =>
      h(DitoSchemaForm, null, {
        default: () => [
          h(DitoTextField, { name: 'name' }),
          h(
            DitoListField,
            { name: 'prices', creatable: true, deletable: true },
            { default: () => h(DitoNumberField, { label: 'Price', step: 5 }) }
          ),
          h(
            DitoListField,
            {
              name: 'chapters',
              collapsible: true,
              collapsed: true,
              creatable: true,
              deletable: true
            },
            {
              default: ({ item }: { item: Chapter }) =>
                item.type === 'section'
                  ? h(DitoTextField, { name: 'name', label: 'Section Name' })
                  : [
                      h(DitoTextField, { name: 'title', width: '3/4' }),
                      h(DitoNumberField, { name: 'discount', width: '1/4' })
                    ]
            }
          )
        ]
      })
  }
})
