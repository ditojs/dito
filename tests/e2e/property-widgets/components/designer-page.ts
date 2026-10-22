import { defineComponent, h, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoSwitchField,
  DitoListField,
  DitoSection,
  DitoCustomField
} from '@ditojs/admin'
import type { Designer } from '../models/Designer.js'

// A page that edits designers with widgets for the properties of its form,
// which hold the data's rules:
export default defineComponent({
  setup() {
    const route = useRoute()
    const form = useDitoForm<Designer>({
      resource: 'designers',
      id: () => (route.params.id as string) || null,
      properties: {
        name: { type: 'string', required: true },
        email: { type: 'string', format: 'email', nullable: true },
        isFeatured: { type: 'boolean', default: false },
        rank: {
          type: 'integer',
          minimum: 1,
          nullable: true,
          if: ({ item }: { item: Designer }) => !!item.isFeatured
        },
        awards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', required: true },
              year: { type: 'integer', nullable: true, range: [1900, 2100] }
            }
          }
        },
        address: {
          type: 'object',
          properties: { city: { type: 'string' } }
        }
      }
    })
    // The page's own toggle for the contact, which hides its widgets:
    const showsContact = ref(true)
    return () => [
      h(
        'button',
        {
          class: 'toggle-contact',
          type: 'button',
          onClick: () => (showsContact.value = !showsContact.value)
        },
        showsContact.value ? 'Hide Contact' : 'Show Contact'
      ),
      h(DitoSchemaForm, null, {
        default: () => [
          h(DitoTextField, { name: 'name', width: '1/2' }),
          // Display content without a value, in a line of its own:
          h(
            DitoCustomField,
            { label: 'Profile', width: '1/4', break: 'before' },
            () => h('span', { class: 'designer-profile' }, form.item?.name)
          ),
          showsContact.value
            ? h(
                DitoSection,
                { name: 'contact' },
                {
                  default: () =>
                    h(DitoTextField, { name: 'email', type: 'email' })
                }
              )
            : null,
          h(DitoSwitchField, { name: 'isFeatured', label: 'Featured' }),
          h(
            DitoSection,
            {
              name: 'ranking',
              label: 'Ranking',
              collapsible: true,
              collapsed: true
            },
            { default: () => h(DitoNumberField, { name: 'rank' }) }
          ),
          h(
            DitoListField,
            {
              name: 'awards',
              collapsible: true,
              collapsed: true,
              creatable: true,
              deletable: true
            },
            {
              default: () => [
                h(DitoTextField, { name: 'title', width: '3/4' }),
                h(DitoNumberField, { name: 'year', width: '1/4' })
              ]
            }
          ),
          h(
            DitoSection,
            { name: 'address', label: 'Address', nested: true },
            { default: () => h(DitoTextField, { name: 'city' }) }
          )
        ]
      })
    ]
  }
})
