import type {
  Components, ViewSchema
} from '@ditojs/admin'

export function createWidgetView<T>(
  itemLabel: string,
  resource: string,
  components: Components<T>,
  listOptions: Record<string, unknown> = {}
): ViewSchema<T> {
  return {
    type: 'view',
    component: {
      type: 'list',
      itemLabel,
      resource: { path: resource },
      editable: true,
      form: { type: 'form', components },
      ...listOptions
    }
  }
}
