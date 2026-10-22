import { defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoListField
} from '@ditojs/admin'
import type { Cut, ShopSet } from '../models/ShopSet.js'

// A page that edits sets of a shop, with prices and cuts of two kinds, laid
// out by their type:
export default defineComponent({
  setup() {
    const route = useRoute()
    useDitoForm<ShopSet>({
      resource: 'shop-sets',
      id: () => (route.params.id as string) || null,
      properties: {
        name: { type: 'string', required: true },
        prices: { type: 'array', items: { type: 'number', minimum: 0 } },
        cuts: {
          type: 'array',
          forms: {
            style: {
              label: 'Style',
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
              name: 'cuts',
              collapsible: true,
              collapsed: true,
              creatable: true,
              deletable: true
            },
            {
              default: ({ item }: { item: Cut }) =>
                item.type === 'style'
                  ? h(DitoTextField, { name: 'name', label: 'Style Name' })
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
