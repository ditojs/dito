import type { Components, ListSchema, ViewSchema } from '@ditojs/admin'

export function createWidgetView<T>(
  itemLabel: string,
  resource: string,
  fields: Components<T>,
  listOptions: Partial<ListSchema<T>> = {}
): ViewSchema<T> {
  return {
    type: 'view',
    field: {
      type: 'list',
      itemLabel,
      resource: { path: resource },
      editable: true,
      form: { type: 'form', fields },
      ...listOptions
    }
  }
}
