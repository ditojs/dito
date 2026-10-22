import { defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoTreeListField
} from '@ditojs/admin'
import type { Collection } from '../models/Collection.js'

const nameProperties = {
  name: { type: 'string', required: true }
} as const

// A page that edits the shop sets of a collection and their cuts in a tree,
// one slot per level:
export default defineComponent({
  setup() {
    const route = useRoute()
    useDitoForm<Collection>({
      resource: 'collections',
      id: () => (route.params.id as string) || null,
      properties: {
        name: { type: 'string', required: true },
        shopSets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...nameProperties,
              cuts: {
                type: 'array',
                items: { type: 'object', properties: nameProperties }
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
            DitoTreeListField,
            { name: 'shopSets', itemLabel: 'name', deletable: true },
            {
              shopSets: () => h(DitoTextField, { name: 'name', label: 'Set' }),
              cuts: () => h(DitoTextField, { name: 'name', label: 'Cut' })
            }
          )
        ]
      })
  }
})
