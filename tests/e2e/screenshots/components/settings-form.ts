import { defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoSelectField,
  DitoSection
} from '@ditojs/admin'
import type { Project } from '../models/Project.js'

// A form that edits the settings of the page's project in a dialog, ending in
// a section with a label:
export default defineComponent({
  setup() {
    const route = useRoute()
    useDitoForm<Project>({
      resource: 'projects',
      id: () => route.params.id as string,
      properties: {
        name: { type: 'string', required: true },
        settings: {
          type: 'object',
          properties: {
            visibility: { type: 'string', nullable: true },
            reviewer: { type: 'string', nullable: true }
          }
        }
      }
    })
    return () =>
      h(DitoSchemaForm, null, {
        default: () => [
          h(DitoTextField, { name: 'name' }),
          h(
            DitoSection,
            { name: 'settings', label: 'Settings', nested: true },
            {
              default: () => [
                h(DitoSelectField, {
                  name: 'visibility',
                  width: '1/2',
                  options: ['Private', 'Public']
                }),
                h(DitoTextField, { name: 'reviewer', width: '1/2' })
              ]
            }
          )
        ]
      })
  }
})
