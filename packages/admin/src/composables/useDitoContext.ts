import { inject } from 'vue'
import { schemaContextKey } from '../utils/keys.ts'

// The context of the form, or of the list item, that the component is in:
export function useDitoContext() {
  const context = inject(schemaContextKey, null)
  if (!context) {
    throw new Error('Unable to use the context outside of forms.')
  }
  return context
}
