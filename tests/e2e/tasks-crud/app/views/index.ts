// tests/e2e/tasks-crud/app/views/index.ts
import type { ViewSchema } from '@ditojs/admin'

export const tasks: ViewSchema = {
  type: 'view',
  component: {
    type: 'list',
    itemLabel: 'name',
    resource: { path: 'tasks' },
    columns: {
      name: { label: 'Name' },
      done: { label: 'Done' }
    },
    creatable: true,
    editable: true,
    deletable: true,
    form: {
      type: 'form',
      components: {
        name: { type: 'text', label: 'Name' },
        done: {
          type: 'checkbox', label: 'Done'
        }
      }
    }
  }
}
