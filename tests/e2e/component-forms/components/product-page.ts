import { defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'
import { useDitoForm, DitoSchemaForm } from '@ditojs/admin'
import type { Product } from '../models/Product.js'

// A page that edits the product of its route's id, or creates one without:
export default defineComponent({
  setup() {
    const route = useRoute()
    const form = useDitoForm<Product>({
      resource: 'products',
      id: () => (route.params.id as string) || null,
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        price: { type: 'integer', label: 'Price' }
      }
    })
    return () => [
      h(DitoSchemaForm),
      h('p', { class: 'product-summary' }, form.item?.name ?? '')
    ]
  }
})
