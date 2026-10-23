import { defineComponent, h } from 'vue'
import { useRoute } from 'vue-router'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoCustomField,
  DitoRadioField,
  DitoUploadField,
  DitoSection,
  DitoSwitchField,
  DitoTextField,
  DitoTreeListField,
  DitoTreeLevel
} from '@ditojs/admin'
import type { Project } from '../models/Project.js'
import settingsForm from './settings-form.js'

const messageStyle = {
  padding: '0.75em 1em',
  borderRadius: '4px',
  background: '#fff8e1'
}

// A tool page that plans the project of its route's id with widgets: a
// message, fields, a section, a tree with the form of its selected item, and a
// panel that opens a form in a dialog.
export default defineComponent({
  setup() {
    const route = useRoute()
    useDitoForm<Project>({
      resource: 'projects',
      id: () => route.params.id as string,
      properties: {
        priority: { type: 'string', nullable: true },
        files: { type: 'array', nullable: true, items: { type: 'asset' } },
        active: { type: 'boolean', nullable: true },
        phases: {
          type: 'array',
          nullable: true,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', required: true },
              lead: { type: 'string', nullable: true },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string', required: true } }
                }
              }
            }
          }
        }
      },
      panels: {
        settings: {
          type: 'panel',
          label: 'Settings',
          fields: {
            editSettings: {
              type: 'button',
              text: 'Edit Settings',
              onClick: ({ showDialog }) => {
                showDialog({
                  fields: {
                    settings: {
                      type: 'component',
                      label: false,
                      component: settingsForm
                    }
                  },
                  buttons: {}
                })
              }
            }
          }
        }
      }
    })
    return () =>
      h(DitoSchemaForm, null, {
        default: () => [
          h(DitoCustomField, null, () =>
            h(
              'div',
              { style: messageStyle },
              'Plan the phases of the project before the team starts.'
            )
          ),
          h(DitoRadioField, {
            name: 'priority',
            layout: 'horizontal',
            width: '1/2',
            options: ['Low', 'Medium', 'High']
          }),
          h(DitoUploadField, { name: 'files', width: '1/2' }),
          h(
            DitoSection,
            { name: 'state', label: 'State' },
            { default: () => h(DitoSwitchField, { name: 'active' }) }
          ),
          h(
            DitoTreeListField,
            {
              name: 'phases',
              itemLabel: 'name',
              collapsed: false,
              deletable: true
            },
            {
              // The form of phases ends in a section with a label:
              form: () => [
                h(DitoTextField, { name: 'name', label: 'Phase Name' }),
                h(
                  DitoSection,
                  { name: 'team', label: 'Team' },
                  { default: () => h(DitoTextField, { name: 'lead' }) }
                )
              ],
              default: () =>
                h(
                  DitoTreeLevel,
                  { name: 'tasks', itemLabel: 'name' },
                  {
                    form: () =>
                      h(DitoTextField, { name: 'name', label: 'Task Name' })
                  }
                )
            }
          )
        ]
      })
  }
})
